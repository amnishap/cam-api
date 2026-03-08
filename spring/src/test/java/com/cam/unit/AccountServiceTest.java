package com.cam.unit;

import com.cam.dto.CreateAccountRequest;
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
import com.cam.service.AccountService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AccountService Unit Tests")
class AccountServiceTest {

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private CardRepository cardRepository;

    @InjectMocks
    private AccountService accountService;

    private UUID accountId;
    private Account testAccount;

    @BeforeEach
    void setUp() {
        accountId = UUID.randomUUID();
        testAccount = Account.builder()
            .id(accountId)
            .externalRef("EXT-001")
            .firstName("John")
            .lastName("Doe")
            .email("john.doe@example.com")
            .status(AccountStatus.INACTIVE)
            .kycStatus(KycStatus.PENDING)
            .creditLimitCents(500000L)
            .availableBalanceCents(500000L)
            .statementBalanceCents(0L)
            .currency("USD")
            .createdAt(LocalDateTime.now())
            .updatedAt(LocalDateTime.now())
            .build();
    }

    @Nested
    @DisplayName("create()")
    class Create {

        @Test
        @DisplayName("should create account with INACTIVE status and PENDING KYC")
        void shouldCreateAccountSuccessfully() {
            CreateAccountRequest request = new CreateAccountRequest();
            request.setExternalRef("EXT-001");
            request.setFirstName("John");
            request.setLastName("Doe");
            request.setEmail("john.doe@example.com");
            request.setCreditLimitCents(500000L);

            when(accountRepository.existsByEmail(request.getEmail())).thenReturn(false);
            when(accountRepository.existsByExternalRef(request.getExternalRef())).thenReturn(false);
            when(accountRepository.save(any(Account.class))).thenAnswer(inv -> inv.getArgument(0));

            Account result = accountService.create(request);

            assertThat(result.getStatus()).isEqualTo(AccountStatus.INACTIVE);
            assertThat(result.getKycStatus()).isEqualTo(KycStatus.PENDING);
            assertThat(result.getCreditLimitCents()).isEqualTo(500000L);
            assertThat(result.getAvailableBalanceCents()).isEqualTo(500000L);
            assertThat(result.getStatementBalanceCents()).isEqualTo(0L);
            assertThat(result.getCurrency()).isEqualTo("USD");
        }

        @Test
        @DisplayName("should throw ConflictException when email already exists")
        void shouldThrowConflictOnDuplicateEmail() {
            CreateAccountRequest request = new CreateAccountRequest();
            request.setEmail("john.doe@example.com");
            request.setExternalRef("EXT-001");

            when(accountRepository.existsByEmail(request.getEmail())).thenReturn(true);

            assertThatThrownBy(() -> accountService.create(request))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("john.doe@example.com");
        }

        @Test
        @DisplayName("should throw ConflictException when externalRef already exists")
        void shouldThrowConflictOnDuplicateExternalRef() {
            CreateAccountRequest request = new CreateAccountRequest();
            request.setEmail("new@example.com");
            request.setExternalRef("EXT-001");

            when(accountRepository.existsByEmail(request.getEmail())).thenReturn(false);
            when(accountRepository.existsByExternalRef(request.getExternalRef())).thenReturn(true);

            assertThatThrownBy(() -> accountService.create(request))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("EXT-001");
        }

        @Test
        @DisplayName("should set default currency to USD when not provided")
        void shouldDefaultCurrencyToUSD() {
            CreateAccountRequest request = new CreateAccountRequest();
            request.setEmail("test@example.com");
            request.setExternalRef("EXT-002");
            request.setCreditLimitCents(100000L);

            when(accountRepository.existsByEmail(any())).thenReturn(false);
            when(accountRepository.existsByExternalRef(any())).thenReturn(false);
            when(accountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Account result = accountService.create(request);
            assertThat(result.getCurrency()).isEqualTo("USD");
        }
    }

    @Nested
    @DisplayName("getById()")
    class GetById {

        @Test
        @DisplayName("should return account when found")
        void shouldReturnAccountWhenFound() {
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(testAccount));

            Account result = accountService.getById(accountId);

            assertThat(result).isEqualTo(testAccount);
        }

        @Test
        @DisplayName("should throw NotFoundException when account does not exist")
        void shouldThrowNotFoundWhenMissing() {
            when(accountRepository.findById(accountId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> accountService.getById(accountId))
                .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    @DisplayName("update() — status transitions")
    class UpdateStatusTransitions {

        @Test
        @DisplayName("should activate account when KYC is VERIFIED")
        void shouldActivateWhenKycVerified() {
            testAccount.setKycStatus(KycStatus.VERIFIED);
            UpdateAccountRequest request = new UpdateAccountRequest();
            request.setStatus(AccountStatus.ACTIVE);

            when(accountRepository.findById(accountId)).thenReturn(Optional.of(testAccount));
            when(accountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Account result = accountService.update(accountId, request);
            assertThat(result.getStatus()).isEqualTo(AccountStatus.ACTIVE);
        }

        @Test
        @DisplayName("should throw BusinessRuleException when activating without KYC VERIFIED")
        void shouldRejectActivationWithoutKyc() {
            testAccount.setKycStatus(KycStatus.PENDING);
            UpdateAccountRequest request = new UpdateAccountRequest();
            request.setStatus(AccountStatus.ACTIVE);

            when(accountRepository.findById(accountId)).thenReturn(Optional.of(testAccount));

            assertThatThrownBy(() -> accountService.update(accountId, request))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("KYC must be VERIFIED")
                .extracting(ex -> ((BusinessRuleException) ex).getErrorCode())
                .isEqualTo("KYC_NOT_VERIFIED");
        }

        @Test
        @DisplayName("should throw BusinessRuleException for invalid status transition")
        void shouldRejectInvalidTransition() {
            testAccount.setStatus(AccountStatus.CLOSED);
            UpdateAccountRequest request = new UpdateAccountRequest();
            request.setStatus(AccountStatus.ACTIVE);

            when(accountRepository.findById(accountId)).thenReturn(Optional.of(testAccount));

            assertThatThrownBy(() -> accountService.update(accountId, request))
                .isInstanceOf(BusinessRuleException.class)
                .extracting(ex -> ((BusinessRuleException) ex).getErrorCode())
                .isEqualTo("INVALID_STATUS_TRANSITION");
        }

        @Test
        @DisplayName("should reject direct CLOSED transition via update endpoint")
        void shouldRejectDirectClosedTransition() {
            testAccount.setStatus(AccountStatus.ACTIVE);
            UpdateAccountRequest request = new UpdateAccountRequest();
            request.setStatus(AccountStatus.CLOSED);

            when(accountRepository.findById(accountId)).thenReturn(Optional.of(testAccount));

            assertThatThrownBy(() -> accountService.update(accountId, request))
                .isInstanceOf(BusinessRuleException.class)
                .extracting(ex -> ((BusinessRuleException) ex).getErrorCode())
                .isEqualTo("USE_CLOSE_ENDPOINT");
        }
    }

    @Nested
    @DisplayName("updateKyc()")
    class UpdateKyc {

        @Test
        @DisplayName("should set kycVerifiedAt when status is VERIFIED")
        void shouldSetKycVerifiedAt() {
            UpdateKycRequest request = new UpdateKycRequest();
            request.setKycStatus(KycStatus.VERIFIED);

            when(accountRepository.findById(accountId)).thenReturn(Optional.of(testAccount));
            when(accountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Account result = accountService.updateKyc(accountId, request);

            assertThat(result.getKycStatus()).isEqualTo(KycStatus.VERIFIED);
            assertThat(result.getKycVerifiedAt()).isNotNull();
        }

        @Test
        @DisplayName("should throw BusinessRuleException for closed account")
        void shouldRejectKycUpdateOnClosedAccount() {
            testAccount.setStatus(AccountStatus.CLOSED);
            UpdateKycRequest request = new UpdateKycRequest();
            request.setKycStatus(KycStatus.VERIFIED);

            when(accountRepository.findById(accountId)).thenReturn(Optional.of(testAccount));

            assertThatThrownBy(() -> accountService.updateKyc(accountId, request))
                .isInstanceOf(BusinessRuleException.class)
                .extracting(ex -> ((BusinessRuleException) ex).getErrorCode())
                .isEqualTo("ACCOUNT_CLOSED");
        }
    }

    @Nested
    @DisplayName("close()")
    class Close {

        @Test
        @DisplayName("should close account when conditions are met")
        void shouldCloseAccountSuccessfully() {
            testAccount.setStatus(AccountStatus.ACTIVE);
            testAccount.setStatementBalanceCents(0L);

            when(accountRepository.findById(accountId)).thenReturn(Optional.of(testAccount));
            when(cardRepository.countByAccountIdAndStatusNot(accountId, CardStatus.CLOSED)).thenReturn(0L);
            when(accountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Account result = accountService.close(accountId);
            assertThat(result.getStatus()).isEqualTo(AccountStatus.CLOSED);
        }

        @Test
        @DisplayName("should throw ConflictException when already closed")
        void shouldRejectClosingAlreadyClosed() {
            testAccount.setStatus(AccountStatus.CLOSED);

            when(accountRepository.findById(accountId)).thenReturn(Optional.of(testAccount));

            assertThatThrownBy(() -> accountService.close(accountId))
                .isInstanceOf(ConflictException.class);
        }

        @Test
        @DisplayName("should throw BusinessRuleException when outstanding balance exists")
        void shouldRejectClosingWithOutstandingBalance() {
            testAccount.setStatus(AccountStatus.ACTIVE);
            testAccount.setStatementBalanceCents(10000L);

            when(accountRepository.findById(accountId)).thenReturn(Optional.of(testAccount));

            assertThatThrownBy(() -> accountService.close(accountId))
                .isInstanceOf(BusinessRuleException.class)
                .extracting(ex -> ((BusinessRuleException) ex).getErrorCode())
                .isEqualTo("OUTSTANDING_BALANCE");
        }

        @Test
        @DisplayName("should throw BusinessRuleException when active cards exist")
        void shouldRejectClosingWithActiveCards() {
            testAccount.setStatus(AccountStatus.ACTIVE);
            testAccount.setStatementBalanceCents(0L);

            when(accountRepository.findById(accountId)).thenReturn(Optional.of(testAccount));
            when(cardRepository.countByAccountIdAndStatusNot(accountId, CardStatus.CLOSED)).thenReturn(2L);

            assertThatThrownBy(() -> accountService.close(accountId))
                .isInstanceOf(BusinessRuleException.class)
                .extracting(ex -> ((BusinessRuleException) ex).getErrorCode())
                .isEqualTo("ACTIVE_CARDS_EXIST");
        }
    }
}
