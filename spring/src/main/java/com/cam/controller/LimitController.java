package com.cam.controller;

import com.cam.dto.SetLimitsRequest;
import com.cam.service.LimitService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class LimitController {

    private final LimitService limitService;

    // PUT /api/v1/accounts/:id/limits
    @PutMapping("/accounts/{id}/limits")
    public ResponseEntity<Map<String, Object>> setAccountLimits(
        @PathVariable UUID id,
        @Valid @RequestBody SetLimitsRequest request
    ) {
        Map<String, Object> result = limitService.setAccountLimits(id, request.getLimits());
        return ResponseEntity.ok(result);
    }

    // GET /api/v1/accounts/:id/limits
    @GetMapping("/accounts/{id}/limits")
    public ResponseEntity<Map<String, Object>> getAccountLimits(@PathVariable UUID id) {
        Map<String, Object> result = limitService.getAccountLimits(id);
        return ResponseEntity.ok(result);
    }

    // PUT /api/v1/cards/:id/limits
    @PutMapping("/cards/{id}/limits")
    public ResponseEntity<Map<String, Object>> setCardLimits(
        @PathVariable UUID id,
        @Valid @RequestBody SetLimitsRequest request
    ) {
        Map<String, Object> result = limitService.setCardLimits(id, request.getLimits());
        return ResponseEntity.ok(result);
    }

    // GET /api/v1/cards/:id/limits
    @GetMapping("/cards/{id}/limits")
    public ResponseEntity<Map<String, Object>> getCardLimits(@PathVariable UUID id) {
        Map<String, Object> result = limitService.getCardLimits(id);
        return ResponseEntity.ok(result);
    }
}
