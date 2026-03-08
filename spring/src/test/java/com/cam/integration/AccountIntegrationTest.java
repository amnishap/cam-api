package com.cam.integration;

import com.cam.dto.CreateAccountRequest;
import com.cam.dto.UpdateAccountRequest;
import com.cam.dto.UpdateKycRequest;
import com.cam.entity.Account;
import com.cam.enums.AccountStatus;
import com.cam.enums.KycStatus;
import com.cam.repository.AccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.*;

@Disabled("Requires Docker/Testcontainers — run manually when Docker is available")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@Testcontainers
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("Account Integration Tests")
class AccountIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
        .withDatabaseName("cam_test_db")
        .withUsername("cam_user")
        .withPassword("cam_password");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("cam.api-key", () -> "test-api-key");
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AccountRepository accountRepository;

    private static final String API_KEY = "test-api-key";
    private static final String BASE_URL = "/api/v1/accounts";

    private static String createdAccountId;

    @BeforeEach
    void cleanDb() {
        // Only clean before first test (or keep state for ordered tests)
    }

    @AfterAll
    static void cleanup(@Autowired AccountRepository repo) {
        repo.deleteAll();
    }

    @Test
    @Order(1)
    @DisplayName("POST /api/v1/accounts — should create account and return 201")
    void shouldCreateAccount() throws Exception {
        CreateAccountRequest request = new CreateAccountRequest();
        request.setExternalRef("INT-TEST-001");
        request.setFirstName("Jane");
        request.setLastName("Smith");
        request.setEmail("jane.smith@test.com");
        request.setCreditLimitCents(1000000L);
        request.setCurrency("USD");

        String responseBody = mockMvc.perform(post(BASE_URL)
                .header("Authorization", "Bearer " + API_KEY)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.externalRef").value("INT-TEST-001"))
            .andExpect(jsonPath("$.email").value("jane.smith@test.com"))
            .andExpect(jsonPath("$.status").value("INACTIVE"))
            .andExpect(jsonPath("$.kycStatus").value("PENDING"))
            .andExpect(jsonPath("$.creditLimitCents").value(1000000))
            .andExpect(jsonPath("$.availableBalanceCents").value(1000000))
            .andExpect(jsonPath("$.statementBalanceCents").value(0))
            .andReturn()
            .getResponse()
            .getContentAsString();

        Account created = objectMapper.readValue(responseBody, Account.class);
        createdAccountId = created.getId().toString();
    }

    @Test
    @Order(2)
    @DisplayName("POST /api/v1/accounts — should return 409 for duplicate email")
    void shouldReturn409ForDuplicateEmail() throws Exception {
        CreateAccountRequest request = new CreateAccountRequest();
        request.setExternalRef("INT-TEST-002");
        request.setFirstName("Jane");
        request.setLastName("Smith");
        request.setEmail("jane.smith@test.com"); // same email
        request.setCreditLimitCents(500000L);

        mockMvc.perform(post(BASE_URL)
                .header("Authorization", "Bearer " + API_KEY)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error.code").value("CONFLICT"));
    }

    @Test
    @Order(3)
    @DisplayName("GET /api/v1/accounts/:id — should return account")
    void shouldGetAccountById() throws Exception {
        assertThat(createdAccountId).isNotNull();

        mockMvc.perform(get(BASE_URL + "/" + createdAccountId)
                .header("Authorization", "Bearer " + API_KEY))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(createdAccountId))
            .andExpect(jsonPath("$.externalRef").value("INT-TEST-001"));
    }

    @Test
    @Order(4)
    @DisplayName("GET /api/v1/accounts/:id — should return 404 for unknown id")
    void shouldReturn404ForUnknownAccount() throws Exception {
        mockMvc.perform(get(BASE_URL + "/00000000-0000-0000-0000-000000000000")
                .header("Authorization", "Bearer " + API_KEY))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    @Test
    @Order(5)
    @DisplayName("PATCH /api/v1/accounts/:id/kyc — should update KYC status")
    void shouldUpdateKycStatus() throws Exception {
        assertThat(createdAccountId).isNotNull();

        UpdateKycRequest request = new UpdateKycRequest();
        request.setKycStatus(KycStatus.VERIFIED);

        mockMvc.perform(patch(BASE_URL + "/" + createdAccountId + "/kyc")
                .header("Authorization", "Bearer " + API_KEY)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.kycStatus").value("VERIFIED"))
            .andExpect(jsonPath("$.kycVerifiedAt").isNotEmpty());
    }

    @Test
    @Order(6)
    @DisplayName("PATCH /api/v1/accounts/:id — should activate account after KYC")
    void shouldActivateAccountAfterKyc() throws Exception {
        assertThat(createdAccountId).isNotNull();

        UpdateAccountRequest request = new UpdateAccountRequest();
        request.setStatus(AccountStatus.ACTIVE);

        mockMvc.perform(patch(BASE_URL + "/" + createdAccountId)
                .header("Authorization", "Bearer " + API_KEY)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    @Order(7)
    @DisplayName("PATCH /api/v1/accounts/:id — should reject activation without KYC")
    void shouldRejectActivationWithoutKyc() throws Exception {
        // Create a fresh account with no KYC
        CreateAccountRequest createReq = new CreateAccountRequest();
        createReq.setExternalRef("INT-TEST-NO-KYC");
        createReq.setFirstName("Test");
        createReq.setLastName("User");
        createReq.setEmail("no.kyc@test.com");
        createReq.setCreditLimitCents(100000L);

        String body = mockMvc.perform(post(BASE_URL)
                .header("Authorization", "Bearer " + API_KEY)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createReq)))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();

        String id = objectMapper.readTree(body).get("id").asText();

        UpdateAccountRequest activateReq = new UpdateAccountRequest();
        activateReq.setStatus(AccountStatus.ACTIVE);

        mockMvc.perform(patch(BASE_URL + "/" + id)
                .header("Authorization", "Bearer " + API_KEY)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(activateReq)))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.error.code").value("KYC_NOT_VERIFIED"));
    }

    @Test
    @Order(8)
    @DisplayName("GET /api/v1/accounts/:id/balance — should return balance info")
    void shouldGetAccountBalance() throws Exception {
        assertThat(createdAccountId).isNotNull();

        mockMvc.perform(get(BASE_URL + "/" + createdAccountId + "/balance")
                .header("Authorization", "Bearer " + API_KEY))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.creditLimitCents").value(1000000))
            .andExpect(jsonPath("$.availableBalanceCents").value(1000000))
            .andExpect(jsonPath("$.statementBalanceCents").value(0))
            .andExpect(jsonPath("$.currency").value("USD"));
    }

    @Test
    @Order(9)
    @DisplayName("GET /api/v1/accounts — should return paginated list")
    void shouldListAccountsPaginated() throws Exception {
        mockMvc.perform(get(BASE_URL + "?limit=10")
                .header("Authorization", "Bearer " + API_KEY))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data").isArray())
            .andExpect(jsonPath("$.pagination.limit").value(10))
            .andExpect(jsonPath("$.pagination.hasMore").isBoolean());
    }

    @Test
    @Order(10)
    @DisplayName("DELETE /api/v1/accounts/:id — should reject close with active cards prereq not met")
    void shouldCloseAccountWhenConditionsMet() throws Exception {
        // Create and fully set up a fresh account to close
        CreateAccountRequest createReq = new CreateAccountRequest();
        createReq.setExternalRef("INT-TEST-CLOSE");
        createReq.setFirstName("Close");
        createReq.setLastName("Me");
        createReq.setEmail("close.me@test.com");
        createReq.setCreditLimitCents(0L);

        String createBody = mockMvc.perform(post(BASE_URL)
                .header("Authorization", "Bearer " + API_KEY)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createReq)))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();

        String closeId = objectMapper.readTree(createBody).get("id").asText();

        // Close it (INACTIVE -> CLOSED is not directly allowed, need to go through proper flow)
        // Update KYC to VERIFIED first, then activate, then close
        UpdateKycRequest kycReq = new UpdateKycRequest();
        kycReq.setKycStatus(KycStatus.VERIFIED);
        mockMvc.perform(patch(BASE_URL + "/" + closeId + "/kyc")
            .header("Authorization", "Bearer " + API_KEY)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(kycReq)));

        UpdateAccountRequest activateReq = new UpdateAccountRequest();
        activateReq.setStatus(AccountStatus.ACTIVE);
        mockMvc.perform(patch(BASE_URL + "/" + closeId)
            .header("Authorization", "Bearer " + API_KEY)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(activateReq)));

        // Now close
        mockMvc.perform(delete(BASE_URL + "/" + closeId)
                .header("Authorization", "Bearer " + API_KEY))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CLOSED"));
    }

    @Test
    @Order(11)
    @DisplayName("should return 401 when API key is missing")
    void shouldReturn401WithoutApiKey() throws Exception {
        mockMvc.perform(get(BASE_URL))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    @Test
    @Order(12)
    @DisplayName("should return 401 when API key is wrong")
    void shouldReturn401WithWrongApiKey() throws Exception {
        mockMvc.perform(get(BASE_URL)
                .header("Authorization", "Bearer wrong-key"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }
}
