package com.cam.controller;

import com.cam.dto.*;
import com.cam.entity.Account;
import com.cam.entity.Card;
import com.cam.enums.AccountStatus;
import com.cam.enums.KycStatus;
import com.cam.service.AccountService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/accounts")
@RequiredArgsConstructor
public class AccountController {

    private final AccountService accountService;

    // POST /api/v1/accounts
    @PostMapping
    public ResponseEntity<Account> create(@Valid @RequestBody CreateAccountRequest request) {
        Account account = accountService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(account);
    }

    // GET /api/v1/accounts
    @GetMapping
    public ResponseEntity<PaginatedResponse<Account>> list(
        @RequestParam(required = false) AccountStatus status,
        @RequestParam(required = false) KycStatus kycStatus,
        @RequestParam(required = false) String cursor,
        @RequestParam(defaultValue = "20") int limit
    ) {
        int clampedLimit = Math.min(Math.max(1, limit), 100);
        PaginatedResponse<Account> result = accountService.list(status, kycStatus, cursor, clampedLimit);
        return ResponseEntity.ok(result);
    }

    // GET /api/v1/accounts/:id
    @GetMapping("/{id}")
    public ResponseEntity<Account> getById(@PathVariable UUID id) {
        Account account = accountService.getById(id);
        return ResponseEntity.ok(account);
    }

    // PATCH /api/v1/accounts/:id
    @PatchMapping("/{id}")
    public ResponseEntity<Account> update(
        @PathVariable UUID id,
        @Valid @RequestBody UpdateAccountRequest request
    ) {
        Account account = accountService.update(id, request);
        return ResponseEntity.ok(account);
    }

    // DELETE /api/v1/accounts/:id (soft close)
    @DeleteMapping("/{id}")
    public ResponseEntity<Account> close(@PathVariable UUID id) {
        Account account = accountService.close(id);
        return ResponseEntity.ok(account);
    }

    // PATCH /api/v1/accounts/:id/kyc
    @PatchMapping("/{id}/kyc")
    public ResponseEntity<Account> updateKyc(
        @PathVariable UUID id,
        @Valid @RequestBody UpdateKycRequest request
    ) {
        Account account = accountService.updateKyc(id, request);
        return ResponseEntity.ok(account);
    }

    // GET /api/v1/accounts/:id/balance
    @GetMapping("/{id}/balance")
    public ResponseEntity<Map<String, Object>> getBalance(@PathVariable UUID id) {
        Map<String, Object> balance = accountService.getBalance(id);
        return ResponseEntity.ok(balance);
    }

    // GET /api/v1/accounts/:id/cards
    @GetMapping("/{id}/cards")
    public ResponseEntity<PaginatedResponse<Card>> getCards(
        @PathVariable UUID id,
        @RequestParam(required = false) String cursor,
        @RequestParam(defaultValue = "20") int limit
    ) {
        int clampedLimit = Math.min(Math.max(1, limit), 100);
        PaginatedResponse<Card> result = accountService.getCards(id, cursor, clampedLimit);
        return ResponseEntity.ok(result);
    }
}
