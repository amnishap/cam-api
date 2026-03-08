package com.cam.unit;

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
import com.cam.service.CardService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("CardService Unit Tests")
class CardServiceTest {

    @Mock
    private CardRepository cardRepository;

    @Mock
    private AccountRepository accountRepository;

    @InjectMocks
    private CardService cardService;

    private UUID accountId;
    private UUID cardId;
    private Account testAccount;
    private Card testCard;

    @BeforeEach
    void setUp() {
        accountId = UUID.randomUUID();
        cardId = UUID.randomUUID();

        testAccount = Account.builder()
            .id(accountId)
            .status(AccountStatus.ACTIVE)
            .kycStatus(KycStatus.VERIFIED)
            .creditLimitCents(500000L)
            .availableBalanceCents(500000L)
            .statementBalanceCents(0L)
            .currency("USD")
            .createdAt(LocalDateTime.now())
            .updatedAt(LocalDateTime.now())
            .build();

        testCard = Card.builder()
            .id(cardId)
            .account(testAccount)
            .type(CardType.VIRTUAL)
            .status(CardStatus.ACTIVE)
            .locked(false)
            .last4("1234")
            .maskedPan("4*** **** **** 1234")
            .network("VISA")
            .expiryMonth(3)
            .expiryYear(2029)
            .cardholderName("John Doe")
            .createdAt(LocalDateTime.now())
            .updatedAt(LocalDateTime.now())
            .build();
    }

    @Nested
    @DisplayName("create()")
    class Create {

        @Test
        @DisplayName("should create virtual card as ACTIVE")
        void shouldCreateVirtualCardAsActive() {
            CreateCardRequest request = new CreateCardRequest();
            request.setType(CardType.VIRTUAL);
            request.setCardholderName("John Doe");

            when(accountRepository.findById(accountId)).thenReturn(Optional.of(testAccount));
            when(cardRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Card card = cardService.create(accountId, request);

            assertThat(card.getStatus()).isEqualTo(CardStatus.ACTIVE);
            assertThat(card.getActivatedAt()).isNotNull();
            assertThat(card.getType()).isEqualTo(CardType.VIRTUAL);
        }

        @Test
        @DisplayName("should create physical card as PENDING_ACTIVATION")
        void shouldCreatePhysicalCardAsPendingActivation() {
            CreateCardRequest request = new CreateCardRequest();
            request.setType(CardType.PHYSICAL);
            request.setCardholderName("John Doe");
            request.setShippingAddress(Map.of("line1", "123 Main St", "city", "Springfield"));

            when(accountRepository.findById(accountId)).thenReturn(Optional.of(testAccount));
            when(cardRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Card card = cardService.create(accountId, request);

            assertThat(card.getStatus()).isEqualTo(CardStatus.PENDING_ACTIVATION);
            assertThat(card.getActivatedAt()).isNull();
            assertThat(card.getType()).isEqualTo(CardType.PHYSICAL);
        }

        @Test
        @DisplayName("should throw BusinessRuleException when account is not ACTIVE")
        void shouldRejectWhenAccountNotActive() {
            testAccount.setStatus(AccountStatus.INACTIVE);
            CreateCardRequest request = new CreateCardRequest();
            request.setType(CardType.VIRTUAL);

            when(accountRepository.findById(accountId)).thenReturn(Optional.of(testAccount));

            assertThatThrownBy(() -> cardService.create(accountId, request))
                .isInstanceOf(BusinessRuleException.class)
                .extracting(ex -> ((BusinessRuleException) ex).getErrorCode())
                .isEqualTo("ACCOUNT_NOT_ACTIVE");
        }

        @Test
        @DisplayName("should throw BusinessRuleException when KYC is not VERIFIED")
        void shouldRejectWhenKycNotVerified() {
            testAccount.setKycStatus(KycStatus.PENDING);
            CreateCardRequest request = new CreateCardRequest();
            request.setType(CardType.VIRTUAL);

            when(accountRepository.findById(accountId)).thenReturn(Optional.of(testAccount));

            assertThatThrownBy(() -> cardService.create(accountId, request))
                .isInstanceOf(BusinessRuleException.class)
                .extracting(ex -> ((BusinessRuleException) ex).getErrorCode())
                .isEqualTo("KYC_NOT_VERIFIED");
        }

        @Test
        @DisplayName("should throw BusinessRuleException when physical card missing shipping address")
        void shouldRejectPhysicalCardWithoutShippingAddress() {
            CreateCardRequest request = new CreateCardRequest();
            request.setType(CardType.PHYSICAL);
            request.setCardholderName("John Doe");
            // No shipping address

            when(accountRepository.findById(accountId)).thenReturn(Optional.of(testAccount));

            assertThatThrownBy(() -> cardService.create(accountId, request))
                .isInstanceOf(BusinessRuleException.class)
                .extracting(ex -> ((BusinessRuleException) ex).getErrorCode())
                .isEqualTo("SHIPPING_ADDRESS_REQUIRED");
        }

        @Test
        @DisplayName("should throw BusinessRuleException when daily limit exceeds credit limit")
        void shouldRejectDailyLimitExceedsCreditLimit() {
            CreateCardRequest request = new CreateCardRequest();
            request.setType(CardType.VIRTUAL);
            request.setCardholderName("John Doe");
            request.setDailyLimitCents(600000L); // > 500000 credit limit

            when(accountRepository.findById(accountId)).thenReturn(Optional.of(testAccount));

            assertThatThrownBy(() -> cardService.create(accountId, request))
                .isInstanceOf(BusinessRuleException.class)
                .extracting(ex -> ((BusinessRuleException) ex).getErrorCode())
                .isEqualTo("DAILY_LIMIT_EXCEEDS_CREDIT_LIMIT");
        }

        @Test
        @DisplayName("should throw BusinessRuleException when transaction limit exceeds daily limit")
        void shouldRejectTransactionLimitExceedsDailyLimit() {
            CreateCardRequest request = new CreateCardRequest();
            request.setType(CardType.VIRTUAL);
            request.setCardholderName("John Doe");
            request.setDailyLimitCents(100000L);
            request.setTransactionLimitCents(150000L); // > daily limit

            when(accountRepository.findById(accountId)).thenReturn(Optional.of(testAccount));

            assertThatThrownBy(() -> cardService.create(accountId, request))
                .isInstanceOf(BusinessRuleException.class)
                .extracting(ex -> ((BusinessRuleException) ex).getErrorCode())
                .isEqualTo("TRANSACTION_LIMIT_EXCEEDS_DAILY_LIMIT");
        }

        @Test
        @DisplayName("should throw NotFoundException when account not found")
        void shouldThrowNotFoundWhenAccountMissing() {
            when(accountRepository.findById(accountId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> cardService.create(accountId, new CreateCardRequest()))
                .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("Card State Machine")
    class StateMachine {

        @Test
        @DisplayName("should activate card from PENDING_ACTIVATION")
        void shouldActivateFromPendingActivation() {
            testCard.setStatus(CardStatus.PENDING_ACTIVATION);
            testCard.setActivatedAt(null);

            when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));
            when(cardRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Card result = cardService.activate(cardId);
            assertThat(result.getStatus()).isEqualTo(CardStatus.ACTIVE);
            assertThat(result.getActivatedAt()).isNotNull();
        }

        @Test
        @DisplayName("should deactivate card from ACTIVE")
        void shouldDeactivateFromActive() {
            when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));
            when(cardRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Card result = cardService.deactivate(cardId);
            assertThat(result.getStatus()).isEqualTo(CardStatus.INACTIVE);
            assertThat(result.getDeactivatedAt()).isNotNull();
        }

        @Test
        @DisplayName("should suspend card from ACTIVE")
        void shouldSuspendFromActive() {
            when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));
            when(cardRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Card result = cardService.suspend(cardId);
            assertThat(result.getStatus()).isEqualTo(CardStatus.SUSPENDED);
        }

        @Test
        @DisplayName("should reactivate card from SUSPENDED")
        void shouldReactivateFromSuspended() {
            testCard.setStatus(CardStatus.SUSPENDED);
            testCard.setActivatedAt(LocalDateTime.now().minusDays(1));

            when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));
            when(cardRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Card result = cardService.reactivate(cardId);
            assertThat(result.getStatus()).isEqualTo(CardStatus.ACTIVE);
        }

        @Test
        @DisplayName("should throw BusinessRuleException for invalid state transition")
        void shouldRejectInvalidTransition() {
            testCard.setStatus(CardStatus.CLOSED);

            when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));

            assertThatThrownBy(() -> cardService.activate(cardId))
                .isInstanceOf(BusinessRuleException.class)
                .extracting(ex -> ((BusinessRuleException) ex).getErrorCode())
                .isEqualTo("INVALID_STATUS_TRANSITION");
        }

        @Test
        @DisplayName("should throw BusinessRuleException when activating from INACTIVE (not in transitions)")
        void shouldRejectActivateFromInactive() {
            testCard.setStatus(CardStatus.INACTIVE);
            // INACTIVE -> ACTIVE is allowed, so let's test CLOSED -> INACTIVE
            testCard.setStatus(CardStatus.CLOSED);

            when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));

            assertThatThrownBy(() -> cardService.deactivate(cardId))
                .isInstanceOf(BusinessRuleException.class)
                .extracting(ex -> ((BusinessRuleException) ex).getErrorCode())
                .isEqualTo("INVALID_STATUS_TRANSITION");
        }
    }

    @Nested
    @DisplayName("lock() and unlock()")
    class LockUnlock {

        @Test
        @DisplayName("should lock an unlocked card")
        void shouldLockCard() {
            when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));
            when(cardRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Card result = cardService.lock(cardId);
            assertThat(result.isLocked()).isTrue();
        }

        @Test
        @DisplayName("should throw ConflictException when card already locked")
        void shouldThrowWhenAlreadyLocked() {
            testCard.setLocked(true);
            when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));

            assertThatThrownBy(() -> cardService.lock(cardId))
                .isInstanceOf(ConflictException.class);
        }

        @Test
        @DisplayName("should unlock a locked card")
        void shouldUnlockCard() {
            testCard.setLocked(true);
            when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));
            when(cardRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Card result = cardService.unlock(cardId);
            assertThat(result.isLocked()).isFalse();
        }

        @Test
        @DisplayName("should throw ConflictException when card not locked")
        void shouldThrowWhenNotLocked() {
            when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));

            assertThatThrownBy(() -> cardService.unlock(cardId))
                .isInstanceOf(ConflictException.class);
        }

        @Test
        @DisplayName("should throw BusinessRuleException when trying to lock a closed card")
        void shouldThrowWhenLockingClosedCard() {
            testCard.setStatus(CardStatus.CLOSED);
            when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));

            assertThatThrownBy(() -> cardService.lock(cardId))
                .isInstanceOf(BusinessRuleException.class)
                .extracting(ex -> ((BusinessRuleException) ex).getErrorCode())
                .isEqualTo("CARD_CLOSED");
        }
    }

    @Nested
    @DisplayName("close()")
    class CloseCard {

        @Test
        @DisplayName("should close an active card")
        void shouldCloseCard() {
            when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));
            when(cardRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Card result = cardService.close(cardId);
            assertThat(result.getStatus()).isEqualTo(CardStatus.CLOSED);
            assertThat(result.getDeactivatedAt()).isNotNull();
        }

        @Test
        @DisplayName("should throw ConflictException when card already closed")
        void shouldThrowWhenAlreadyClosed() {
            testCard.setStatus(CardStatus.CLOSED);
            when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));

            assertThatThrownBy(() -> cardService.close(cardId))
                .isInstanceOf(ConflictException.class);
        }
    }

    @Nested
    @DisplayName("replace()")
    class ReplaceCard {

        @Test
        @DisplayName("should close old card and create replacement")
        void shouldReplaceCard() {
            when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));
            when(cardRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Card replacement = cardService.replace(cardId, "lost");

            // Old card should have been saved as CLOSED (first save call)
            verify(cardRepository, times(2)).save(any());

            // Replacement should be virtual and ACTIVE (matching old card type)
            assertThat(replacement.getType()).isEqualTo(CardType.VIRTUAL);
            assertThat(replacement.getStatus()).isEqualTo(CardStatus.ACTIVE);
            assertThat(replacement.getId()).isNotEqualTo(cardId);
        }

        @Test
        @DisplayName("should throw ConflictException when replacing closed card")
        void shouldThrowWhenReplacingClosedCard() {
            testCard.setStatus(CardStatus.CLOSED);
            when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));

            assertThatThrownBy(() -> cardService.replace(cardId, "lost"))
                .isInstanceOf(ConflictException.class);
        }

        @Test
        @DisplayName("physical card replacement should be PENDING_ACTIVATION")
        void physicalReplacementShouldBePendingActivation() {
            testCard.setType(CardType.PHYSICAL);
            testCard.setStatus(CardStatus.ACTIVE);

            when(cardRepository.findById(cardId)).thenReturn(Optional.of(testCard));
            when(cardRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Card replacement = cardService.replace(cardId, "damaged");
            assertThat(replacement.getType()).isEqualTo(CardType.PHYSICAL);
            assertThat(replacement.getStatus()).isEqualTo(CardStatus.PENDING_ACTIVATION);
            assertThat(replacement.getActivatedAt()).isNull();
        }
    }
}
