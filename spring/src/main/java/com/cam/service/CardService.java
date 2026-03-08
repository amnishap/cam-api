package com.cam.service;

import com.cam.dto.CreateCardRequest;
import com.cam.dto.UpdateCardRequest;
import com.cam.entity.Account;
import com.cam.entity.Card;
import com.cam.enums.AccountStatus;
import com.cam.enums.CardStatus;
import com.cam.enums.CardType;
import com.cam.enums.KycStatus;
import com.cam.exception.BusinessRuleException;
import com.cam.exception.ConflictException;
import com.cam.exception.NotFoundException;
import com.cam.repository.AccountRepository;
import com.cam.repository.CardRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CardService {

    private static final Map<CardStatus, List<CardStatus>> CARD_TRANSITIONS =
        new EnumMap<>(CardStatus.class);

    private static final Random RANDOM = new Random();

    static {
        CARD_TRANSITIONS.put(CardStatus.PENDING_ACTIVATION, List.of(CardStatus.ACTIVE, CardStatus.CLOSED));
        CARD_TRANSITIONS.put(CardStatus.ACTIVE, List.of(CardStatus.INACTIVE, CardStatus.SUSPENDED, CardStatus.CLOSED));
        CARD_TRANSITIONS.put(CardStatus.INACTIVE, List.of(CardStatus.ACTIVE, CardStatus.CLOSED));
        CARD_TRANSITIONS.put(CardStatus.SUSPENDED, List.of(CardStatus.ACTIVE, CardStatus.CLOSED));
        CARD_TRANSITIONS.put(CardStatus.CLOSED, List.of());
    }

    private final CardRepository cardRepository;
    private final AccountRepository accountRepository;

    @Transactional
    public Card create(UUID accountId, CreateCardRequest request) {
        Account account = accountRepository.findById(accountId)
            .orElseThrow(() -> new NotFoundException("Account", accountId));

        if (account.getStatus() != AccountStatus.ACTIVE) {
            throw new BusinessRuleException(
                "ACCOUNT_NOT_ACTIVE",
                "Account must be ACTIVE to create a card (current status: " + account.getStatus() + ")"
            );
        }

        if (account.getKycStatus() != KycStatus.VERIFIED) {
            throw new BusinessRuleException(
                "KYC_NOT_VERIFIED",
                "Account KYC must be VERIFIED to create a card (current status: " + account.getKycStatus() + ")"
            );
        }

        if (request.getType() == CardType.PHYSICAL && request.getShippingAddress() == null) {
            throw new BusinessRuleException(
                "SHIPPING_ADDRESS_REQUIRED",
                "Physical cards require a shippingAddress"
            );
        }

        validateCardLimitHierarchy(
            request.getDailyLimitCents(),
            request.getMonthlyLimitCents(),
            request.getTransactionLimitCents(),
            account.getCreditLimitCents()
        );

        String last4 = generateMockLast4();
        String network = request.getNetwork() != null ? request.getNetwork() : "VISA";
        String maskedPan = generateMaskedPan(last4, network);
        ExpiryDate expiry = getExpiryDate();
        boolean isVirtual = request.getType() == CardType.VIRTUAL;

        Card card = Card.builder()
            .id(UUID.randomUUID())
            .account(account)
            .type(request.getType())
            .status(isVirtual ? CardStatus.ACTIVE : CardStatus.PENDING_ACTIVATION)
            .locked(false)
            .last4(last4)
            .maskedPan(maskedPan)
            .network(network)
            .expiryMonth(expiry.month())
            .expiryYear(expiry.year())
            .expiresAt(LocalDateTime.of(expiry.year(), expiry.month(), 1, 0, 0))
            .cardholderName(request.getCardholderName())
            .shippingAddress(request.getShippingAddress())
            .dailyLimitCents(request.getDailyLimitCents())
            .monthlyLimitCents(request.getMonthlyLimitCents())
            .transactionLimitCents(request.getTransactionLimitCents())
            .activatedAt(isVirtual ? LocalDateTime.now() : null)
            .build();

        return cardRepository.save(card);
    }

    @Transactional(readOnly = true)
    public Card getById(UUID id) {
        return cardRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Card", id));
    }

    @Transactional
    public Card update(UUID id, UpdateCardRequest request) {
        Card card = getById(id);

        if (card.getStatus() == CardStatus.CLOSED) {
            throw new BusinessRuleException("CARD_CLOSED", "Cannot update a closed card");
        }

        // Validate limits if any are being updated
        if (request.getDailyLimitCents() != null
            || request.getMonthlyLimitCents() != null
            || request.getTransactionLimitCents() != null) {

            Account account = accountRepository.findById(card.getAccount().getId())
                .orElseThrow(() -> new NotFoundException("Account", card.getAccount().getId()));

            Long newDaily = request.getDailyLimitCents() != null ? request.getDailyLimitCents() : card.getDailyLimitCents();
            Long newMonthly = request.getMonthlyLimitCents() != null ? request.getMonthlyLimitCents() : card.getMonthlyLimitCents();
            Long newTxn = request.getTransactionLimitCents() != null ? request.getTransactionLimitCents() : card.getTransactionLimitCents();

            validateCardLimitHierarchy(newDaily, newMonthly, newTxn, account.getCreditLimitCents());
        }

        if (request.getCardholderName() != null) card.setCardholderName(request.getCardholderName());
        if (request.getDailyLimitCents() != null) card.setDailyLimitCents(request.getDailyLimitCents());
        if (request.getMonthlyLimitCents() != null) card.setMonthlyLimitCents(request.getMonthlyLimitCents());
        if (request.getTransactionLimitCents() != null) card.setTransactionLimitCents(request.getTransactionLimitCents());

        return cardRepository.save(card);
    }

    @Transactional
    public Card activate(UUID id) {
        return transition(id, CardStatus.ACTIVE, "activate");
    }

    @Transactional
    public Card deactivate(UUID id) {
        return transition(id, CardStatus.INACTIVE, "deactivate");
    }

    @Transactional
    public Card suspend(UUID id) {
        return transition(id, CardStatus.SUSPENDED, "suspend");
    }

    @Transactional
    public Card reactivate(UUID id) {
        return transition(id, CardStatus.ACTIVE, "reactivate");
    }

    @Transactional
    public Card lock(UUID id) {
        Card card = getById(id);
        if (card.getStatus() == CardStatus.CLOSED) {
            throw new BusinessRuleException("CARD_CLOSED", "Cannot lock a closed card");
        }
        if (card.isLocked()) {
            throw new ConflictException("Card is already locked");
        }
        card.setLocked(true);
        return cardRepository.save(card);
    }

    @Transactional
    public Card unlock(UUID id) {
        Card card = getById(id);
        if (card.getStatus() == CardStatus.CLOSED) {
            throw new BusinessRuleException("CARD_CLOSED", "Cannot unlock a closed card");
        }
        if (!card.isLocked()) {
            throw new ConflictException("Card is not locked");
        }
        card.setLocked(false);
        return cardRepository.save(card);
    }

    @Transactional
    public Card close(UUID id) {
        Card card = getById(id);
        if (card.getStatus() == CardStatus.CLOSED) {
            throw new ConflictException("Card is already closed");
        }
        card.setStatus(CardStatus.CLOSED);
        card.setDeactivatedAt(LocalDateTime.now());
        return cardRepository.save(card);
    }

    @Transactional
    public Card replace(UUID id, String reason) {
        Card card = getById(id);

        if (card.getStatus() == CardStatus.CLOSED) {
            throw new ConflictException("Cannot replace a closed card");
        }

        // Close the old card
        card.setStatus(CardStatus.CLOSED);
        card.setDeactivatedAt(LocalDateTime.now());
        cardRepository.save(card);

        // Issue replacement with same type, network, cardholder, and inherited limits
        String last4 = generateMockLast4();
        String maskedPan = generateMaskedPan(last4, card.getNetwork());
        ExpiryDate expiry = getExpiryDate();
        boolean isVirtual = card.getType() == CardType.VIRTUAL;

        Card replacement = Card.builder()
            .id(UUID.randomUUID())
            .account(card.getAccount())
            .type(card.getType())
            .status(isVirtual ? CardStatus.ACTIVE : CardStatus.PENDING_ACTIVATION)
            .locked(false)
            .last4(last4)
            .maskedPan(maskedPan)
            .network(card.getNetwork())
            .expiryMonth(expiry.month())
            .expiryYear(expiry.year())
            .expiresAt(LocalDateTime.of(expiry.year(), expiry.month(), 1, 0, 0))
            .cardholderName(card.getCardholderName())
            .shippingAddress(card.getShippingAddress())
            .dailyLimitCents(card.getDailyLimitCents())
            .monthlyLimitCents(card.getMonthlyLimitCents())
            .transactionLimitCents(card.getTransactionLimitCents())
            .activatedAt(isVirtual ? LocalDateTime.now() : null)
            .build();

        return cardRepository.save(replacement);
    }

    private Card transition(UUID id, CardStatus targetStatus, String action) {
        Card card = getById(id);

        List<CardStatus> allowed = CARD_TRANSITIONS.get(card.getStatus());
        if (allowed == null || !allowed.contains(targetStatus)) {
            throw new BusinessRuleException(
                "INVALID_STATUS_TRANSITION",
                "Cannot " + action + " card in status " + card.getStatus()
            );
        }

        card.setStatus(targetStatus);

        if (targetStatus == CardStatus.ACTIVE && card.getActivatedAt() == null) {
            card.setActivatedAt(LocalDateTime.now());
        }
        if (targetStatus == CardStatus.INACTIVE || targetStatus == CardStatus.CLOSED) {
            card.setDeactivatedAt(LocalDateTime.now());
        }

        return cardRepository.save(card);
    }

    private void validateCardLimitHierarchy(
        Long dailyLimitCents,
        Long monthlyLimitCents,
        Long transactionLimitCents,
        long creditLimitCents
    ) {
        if (dailyLimitCents != null && dailyLimitCents > creditLimitCents) {
            throw new BusinessRuleException(
                "DAILY_LIMIT_EXCEEDS_CREDIT_LIMIT",
                "Card daily limit (" + dailyLimitCents + ") exceeds account credit limit (" + creditLimitCents + ")"
            );
        }

        if (monthlyLimitCents != null && monthlyLimitCents > creditLimitCents) {
            throw new BusinessRuleException(
                "MONTHLY_LIMIT_EXCEEDS_CREDIT_LIMIT",
                "Card monthly limit (" + monthlyLimitCents + ") exceeds account credit limit (" + creditLimitCents + ")"
            );
        }

        if (transactionLimitCents != null) {
            if (dailyLimitCents != null && transactionLimitCents > dailyLimitCents) {
                throw new BusinessRuleException(
                    "TRANSACTION_LIMIT_EXCEEDS_DAILY_LIMIT",
                    "Card per-transaction limit (" + transactionLimitCents + ") exceeds daily limit (" + dailyLimitCents + ")"
                );
            }
            if (transactionLimitCents > creditLimitCents) {
                throw new BusinessRuleException(
                    "TRANSACTION_LIMIT_EXCEEDS_CREDIT_LIMIT",
                    "Card per-transaction limit (" + transactionLimitCents + ") exceeds account credit limit (" + creditLimitCents + ")"
                );
            }
        }
    }

    private String generateMockLast4() {
        return String.format("%04d", 1000 + RANDOM.nextInt(9000));
    }

    private String generateMaskedPan(String last4, String network) {
        String prefix = "AMEX".equals(network) ? "3" : "4";
        return prefix + "*** **** **** " + last4;
    }

    private ExpiryDate getExpiryDate() {
        LocalDateTime now = LocalDateTime.now();
        return new ExpiryDate(now.getMonthValue(), now.getYear() + 3);
    }

    private record ExpiryDate(int month, int year) {}
}
