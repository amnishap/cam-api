package com.cam.service;

import com.cam.dto.SpendingLimitItem;
import com.cam.entity.Account;
import com.cam.entity.AccountSpendingLimit;
import com.cam.entity.Card;
import com.cam.entity.CardSpendingLimit;
import com.cam.enums.LimitType;
import com.cam.exception.BusinessRuleException;
import com.cam.exception.NotFoundException;
import com.cam.repository.AccountRepository;
import com.cam.repository.AccountSpendingLimitRepository;
import com.cam.repository.CardRepository;
import com.cam.repository.CardSpendingLimitRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class LimitService {

    private static final Set<LimitType> MONETARY_LIMIT_TYPES = Set.of(
        LimitType.DAILY, LimitType.MONTHLY, LimitType.PER_TRANSACTION
    );

    private final AccountRepository accountRepository;
    private final CardRepository cardRepository;
    private final AccountSpendingLimitRepository accountSpendingLimitRepository;
    private final CardSpendingLimitRepository cardSpendingLimitRepository;

    @Transactional
    public Map<String, Object> setAccountLimits(UUID accountId, List<SpendingLimitItem> limits) {
        Account account = accountRepository.findById(accountId)
            .orElseThrow(() -> new NotFoundException("Account", accountId));

        validateLimitsAgainstCreditLimit(limits, account.getCreditLimitCents());

        for (SpendingLimitItem limitItem : limits) {
            Optional<AccountSpendingLimit> existing = accountSpendingLimitRepository
                .findByAccountIdAndLimitTypeAndMccCode(
                    accountId,
                    limitItem.getLimitType(),
                    limitItem.getMccCode()
                );

            if (existing.isPresent()) {
                AccountSpendingLimit limit = existing.get();
                limit.setValueCents(limitItem.getValueCents());
                accountSpendingLimitRepository.save(limit);
            } else {
                AccountSpendingLimit limit = AccountSpendingLimit.builder()
                    .id(UUID.randomUUID())
                    .account(account)
                    .limitType(limitItem.getLimitType())
                    .valueCents(limitItem.getValueCents())
                    .mccCode(limitItem.getMccCode())
                    .build();
                accountSpendingLimitRepository.save(limit);
            }
        }

        return getAccountLimits(accountId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getAccountLimits(UUID accountId) {
        accountRepository.findById(accountId)
            .orElseThrow(() -> new NotFoundException("Account", accountId));

        List<AccountSpendingLimit> limits =
            accountSpendingLimitRepository.findByAccountIdOrderByCreatedAtAsc(accountId);

        return Map.of("accountId", accountId, "limits", limits);
    }

    @Transactional
    public Map<String, Object> setCardLimits(UUID cardId, List<SpendingLimitItem> limits) {
        Card card = cardRepository.findById(cardId)
            .orElseThrow(() -> new NotFoundException("Card", cardId));

        Account account = accountRepository.findById(card.getAccount().getId())
            .orElseThrow(() -> new NotFoundException("Account", card.getAccount().getId()));

        validateLimitsAgainstCreditLimit(limits, account.getCreditLimitCents());

        for (SpendingLimitItem limitItem : limits) {
            Optional<CardSpendingLimit> existing = cardSpendingLimitRepository
                .findByCardIdAndLimitTypeAndMccCode(
                    cardId,
                    limitItem.getLimitType(),
                    limitItem.getMccCode()
                );

            if (existing.isPresent()) {
                CardSpendingLimit limit = existing.get();
                limit.setValueCents(limitItem.getValueCents());
                cardSpendingLimitRepository.save(limit);
            } else {
                CardSpendingLimit limit = CardSpendingLimit.builder()
                    .id(UUID.randomUUID())
                    .card(card)
                    .limitType(limitItem.getLimitType())
                    .valueCents(limitItem.getValueCents())
                    .mccCode(limitItem.getMccCode())
                    .build();
                cardSpendingLimitRepository.save(limit);
            }
        }

        return getCardLimits(cardId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getCardLimits(UUID cardId) {
        cardRepository.findById(cardId)
            .orElseThrow(() -> new NotFoundException("Card", cardId));

        List<CardSpendingLimit> limits =
            cardSpendingLimitRepository.findByCardIdOrderByCreatedAtAsc(cardId);

        return Map.of("cardId", cardId, "limits", limits);
    }

    private void validateLimitsAgainstCreditLimit(List<SpendingLimitItem> limits, long creditLimitCents) {
        for (SpendingLimitItem limit : limits) {
            if (limit.getValueCents() != null
                && MONETARY_LIMIT_TYPES.contains(limit.getLimitType())
                && limit.getValueCents() > creditLimitCents) {
                throw new BusinessRuleException(
                    "LIMIT_EXCEEDS_CREDIT_LIMIT",
                    limit.getLimitType() + " limit (" + limit.getValueCents()
                        + ") exceeds account credit limit (" + creditLimitCents + ")"
                );
            }
        }

        // Per-transaction must not exceed daily when both are present in the same batch
        Long daily = limits.stream()
            .filter(l -> l.getLimitType() == LimitType.DAILY)
            .map(SpendingLimitItem::getValueCents)
            .filter(Objects::nonNull)
            .findFirst()
            .orElse(null);

        Long txn = limits.stream()
            .filter(l -> l.getLimitType() == LimitType.PER_TRANSACTION)
            .map(SpendingLimitItem::getValueCents)
            .filter(Objects::nonNull)
            .findFirst()
            .orElse(null);

        if (daily != null && txn != null && txn > daily) {
            throw new BusinessRuleException(
                "TRANSACTION_LIMIT_EXCEEDS_DAILY_LIMIT",
                "Per-transaction limit (" + txn + ") cannot exceed daily limit (" + daily + ")"
            );
        }
    }
}
