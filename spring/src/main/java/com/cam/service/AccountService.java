package com.cam.service;

import com.cam.dto.CreateAccountRequest;
import com.cam.dto.PaginatedResponse;
import com.cam.dto.UpdateAccountRequest;
import com.cam.dto.UpdateKycRequest;
import com.cam.entity.Account;
import com.cam.entity.Card;
import com.cam.enums.AccountStatus;
import com.cam.enums.CardStatus;
import com.cam.enums.KycStatus;
import com.cam.exception.BusinessRuleException;
import com.cam.exception.ConflictException;
import com.cam.exception.NotFoundException;
import com.cam.repository.AccountRepository;
import com.cam.repository.CardRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AccountService {

    private static final Map<AccountStatus, List<AccountStatus>> ACCOUNT_TRANSITIONS =
        new EnumMap<>(AccountStatus.class);

    static {
        ACCOUNT_TRANSITIONS.put(AccountStatus.INACTIVE, List.of(AccountStatus.ACTIVE));
        ACCOUNT_TRANSITIONS.put(AccountStatus.ACTIVE, List.of(AccountStatus.SUSPENDED, AccountStatus.CLOSED));
        ACCOUNT_TRANSITIONS.put(AccountStatus.SUSPENDED, List.of(AccountStatus.ACTIVE, AccountStatus.CLOSED));
        ACCOUNT_TRANSITIONS.put(AccountStatus.CLOSED, List.of());
    }

    private final AccountRepository accountRepository;
    private final CardRepository cardRepository;

    @Transactional
    public Account create(CreateAccountRequest request) {
        // Check for existing email or externalRef
        if (accountRepository.existsByEmail(request.getEmail())) {
            throw new ConflictException(
                "Account with email '" + request.getEmail() + "' already exists"
            );
        }
        if (accountRepository.existsByExternalRef(request.getExternalRef())) {
            throw new ConflictException(
                "Account with externalRef '" + request.getExternalRef() + "' already exists"
            );
        }

        long creditLimit = request.getCreditLimitCents();

        Account account = Account.builder()
            .id(UUID.randomUUID())
            .externalRef(request.getExternalRef())
            .firstName(request.getFirstName())
            .lastName(request.getLastName())
            .email(request.getEmail())
            .phone(request.getPhone())
            .dateOfBirth(request.getDateOfBirth() != null ? LocalDate.parse(request.getDateOfBirth()) : null)
            .taxId(request.getTaxId())
            .addressLine1(request.getAddressLine1())
            .addressLine2(request.getAddressLine2())
            .city(request.getCity())
            .state(request.getState())
            .postalCode(request.getPostalCode())
            .country(request.getCountry())
            .creditLimitCents(creditLimit)
            .availableBalanceCents(creditLimit)
            .statementBalanceCents(0L)
            .currency(request.getCurrency() != null ? request.getCurrency() : "USD")
            .status(AccountStatus.INACTIVE)
            .kycStatus(KycStatus.PENDING)
            .build();

        return accountRepository.save(account);
    }

    @Transactional(readOnly = true)
    public PaginatedResponse<Account> list(
        AccountStatus status,
        KycStatus kycStatus,
        String cursor,
        int limit
    ) {
        int fetchLimit = limit + 1;
        List<Account> items;

        if (cursor != null && !cursor.isBlank()) {
            UUID cursorUuid = UUID.fromString(cursor);
            Account cursorAccount = accountRepository.findById(cursorUuid)
                .orElseThrow(() -> new NotFoundException("Account cursor", cursorUuid));
            items = accountRepository.findByFiltersAfterCursor(
                status, kycStatus, cursorAccount.getCreatedAt(), cursorUuid,
                PageRequest.of(0, fetchLimit)
            );
        } else {
            items = accountRepository.findByFilters(
                status, kycStatus, PageRequest.of(0, fetchLimit)
            );
        }

        return PaginatedResponse.of(items, limit);
    }

    @Transactional(readOnly = true)
    public Account getById(UUID id) {
        return accountRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Account", id));
    }

    @Transactional
    public Account update(UUID id, UpdateAccountRequest request) {
        Account account = getById(id);

        if (request.getStatus() != null) {
            validateStatusTransition(account.getStatus(), request.getStatus());

            // CLOSED status must use the close endpoint
            if (request.getStatus() == AccountStatus.CLOSED) {
                throw new BusinessRuleException(
                    "USE_CLOSE_ENDPOINT",
                    "Use DELETE /accounts/:id to close an account"
                );
            }

            // KYC gate — only allow activation when KYC is VERIFIED
            if (request.getStatus() == AccountStatus.ACTIVE && account.getStatus() == AccountStatus.INACTIVE) {
                if (account.getKycStatus() != KycStatus.VERIFIED) {
                    throw new BusinessRuleException(
                        "KYC_NOT_VERIFIED",
                        "Account KYC must be VERIFIED before activation (current: " + account.getKycStatus() + ")"
                    );
                }
            }
        }

        if (request.getCreditLimitCents() != null) {
            validateCreditLimitReduction(account, request.getCreditLimitCents());
        }

        if (request.getCreditLimitCents() != null) {
            // Use pessimistic lock for balance update
            Account locked = accountRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new NotFoundException("Account", id));

            long delta = request.getCreditLimitCents() - locked.getCreditLimitCents();
            applyUpdateFields(locked, request);
            locked.setAvailableBalanceCents(locked.getAvailableBalanceCents() + delta);
            return accountRepository.save(locked);
        }

        applyUpdateFields(account, request);
        return accountRepository.save(account);
    }

    @Transactional
    public Account updateKyc(UUID id, UpdateKycRequest request) {
        Account account = getById(id);

        if (account.getStatus() == AccountStatus.CLOSED) {
            throw new BusinessRuleException("ACCOUNT_CLOSED", "Cannot update KYC for a closed account");
        }

        account.setKycStatus(request.getKycStatus());
        if (request.getKycStatus() == KycStatus.VERIFIED) {
            account.setKycVerifiedAt(LocalDateTime.now());
        }

        return accountRepository.save(account);
    }

    @Transactional
    public Account close(UUID id) {
        Account account = getById(id);

        if (account.getStatus() == AccountStatus.CLOSED) {
            throw new ConflictException("Account is already closed");
        }

        if (account.getStatementBalanceCents() != 0) {
            throw new BusinessRuleException(
                "OUTSTANDING_BALANCE",
                "Cannot close account with outstanding statement balance"
            );
        }

        long activeCards = cardRepository.countByAccountIdAndStatusNot(id, CardStatus.CLOSED);
        if (activeCards > 0) {
            throw new BusinessRuleException(
                "ACTIVE_CARDS_EXIST",
                "Cannot close account: " + activeCards + " card(s) must be closed first"
            );
        }

        account.setStatus(AccountStatus.CLOSED);
        return accountRepository.save(account);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getBalance(UUID id) {
        Account account = accountRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Account", id));

        return Map.of(
            "id", account.getId(),
            "creditLimitCents", account.getCreditLimitCents(),
            "availableBalanceCents", account.getAvailableBalanceCents(),
            "statementBalanceCents", account.getStatementBalanceCents(),
            "currency", account.getCurrency(),
            "updatedAt", account.getUpdatedAt()
        );
    }

    @Transactional(readOnly = true)
    public PaginatedResponse<Card> getCards(UUID accountId, String cursor, int limit) {
        // Verify account exists
        getById(accountId);

        int fetchLimit = limit + 1;
        List<Card> items;

        if (cursor != null && !cursor.isBlank()) {
            UUID cursorUuid = UUID.fromString(cursor);
            Card cursorCard = cardRepository.findById(cursorUuid)
                .orElseThrow(() -> new NotFoundException("Card cursor", cursorUuid));
            items = cardRepository.findByAccountIdAfterCursor(
                accountId, cursorCard.getCreatedAt(), cursorUuid,
                PageRequest.of(0, fetchLimit)
            );
        } else {
            items = cardRepository.findByAccountId(accountId, PageRequest.of(0, fetchLimit));
        }

        return PaginatedResponse.of(items, limit);
    }

    private void validateStatusTransition(AccountStatus current, AccountStatus next) {
        List<AccountStatus> allowed = ACCOUNT_TRANSITIONS.get(current);
        if (allowed == null || !allowed.contains(next)) {
            throw new BusinessRuleException(
                "INVALID_STATUS_TRANSITION",
                "Cannot transition account from " + current + " to " + next
            );
        }
    }

    private void validateCreditLimitReduction(Account account, long newLimitCents) {
        if (newLimitCents < account.getStatementBalanceCents()) {
            throw new BusinessRuleException(
                "CREDIT_LIMIT_BELOW_BALANCE",
                "New credit limit (" + newLimitCents + ") cannot be less than outstanding balance ("
                    + account.getStatementBalanceCents() + ")"
            );
        }

        // Validate all card limits still fit within new account limit
        List<Card> activeCards = cardRepository.findActiveCardsByAccountId(account.getId(), CardStatus.CLOSED);
        for (Card card : activeCards) {
            if (card.getDailyLimitCents() != null && card.getDailyLimitCents() > newLimitCents) {
                throw new BusinessRuleException(
                    "CARD_LIMIT_EXCEEDS_CREDIT_LIMIT",
                    "Card " + card.getId() + " daily limit (" + card.getDailyLimitCents()
                        + ") exceeds new credit limit (" + newLimitCents + ")"
                );
            }
            if (card.getMonthlyLimitCents() != null && card.getMonthlyLimitCents() > newLimitCents) {
                throw new BusinessRuleException(
                    "CARD_LIMIT_EXCEEDS_CREDIT_LIMIT",
                    "Card " + card.getId() + " monthly limit (" + card.getMonthlyLimitCents()
                        + ") exceeds new credit limit (" + newLimitCents + ")"
                );
            }
        }
    }

    private void applyUpdateFields(Account account, UpdateAccountRequest request) {
        if (request.getStatus() != null) account.setStatus(request.getStatus());
        if (request.getPhone() != null) account.setPhone(request.getPhone());
        if (request.getAddressLine1() != null) account.setAddressLine1(request.getAddressLine1());
        if (request.getAddressLine2() != null) account.setAddressLine2(request.getAddressLine2());
        if (request.getCity() != null) account.setCity(request.getCity());
        if (request.getState() != null) account.setState(request.getState());
        if (request.getPostalCode() != null) account.setPostalCode(request.getPostalCode());
        if (request.getCountry() != null) account.setCountry(request.getCountry());
        if (request.getCreditLimitCents() != null) account.setCreditLimitCents(request.getCreditLimitCents());
    }
}
