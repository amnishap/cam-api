package com.cam.controller;

import com.cam.dto.CreateCardRequest;
import com.cam.dto.ReplaceCardRequest;
import com.cam.dto.UpdateCardRequest;
import com.cam.entity.Card;
import com.cam.service.CardService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class CardController {

    private final CardService cardService;

    // POST /api/v1/accounts/:id/cards
    @PostMapping("/api/v1/accounts/{accountId}/cards")
    public ResponseEntity<Card> create(
        @PathVariable UUID accountId,
        @Valid @RequestBody CreateCardRequest request
    ) {
        Card card = cardService.create(accountId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(card);
    }

    // GET /api/v1/cards/:id
    @GetMapping("/api/v1/cards/{id}")
    public ResponseEntity<Card> getById(@PathVariable UUID id) {
        Card card = cardService.getById(id);
        return ResponseEntity.ok(card);
    }

    // PATCH /api/v1/cards/:id
    @PatchMapping("/api/v1/cards/{id}")
    public ResponseEntity<Card> update(
        @PathVariable UUID id,
        @Valid @RequestBody UpdateCardRequest request
    ) {
        Card card = cardService.update(id, request);
        return ResponseEntity.ok(card);
    }

    // POST /api/v1/cards/:id/activate
    @PostMapping("/api/v1/cards/{id}/activate")
    public ResponseEntity<Card> activate(@PathVariable UUID id) {
        Card card = cardService.activate(id);
        return ResponseEntity.ok(card);
    }

    // POST /api/v1/cards/:id/deactivate
    @PostMapping("/api/v1/cards/{id}/deactivate")
    public ResponseEntity<Card> deactivate(@PathVariable UUID id) {
        Card card = cardService.deactivate(id);
        return ResponseEntity.ok(card);
    }

    // POST /api/v1/cards/:id/suspend
    @PostMapping("/api/v1/cards/{id}/suspend")
    public ResponseEntity<Card> suspend(@PathVariable UUID id) {
        Card card = cardService.suspend(id);
        return ResponseEntity.ok(card);
    }

    // POST /api/v1/cards/:id/reactivate
    @PostMapping("/api/v1/cards/{id}/reactivate")
    public ResponseEntity<Card> reactivate(@PathVariable UUID id) {
        Card card = cardService.reactivate(id);
        return ResponseEntity.ok(card);
    }

    // POST /api/v1/cards/:id/lock
    @PostMapping("/api/v1/cards/{id}/lock")
    public ResponseEntity<Card> lock(@PathVariable UUID id) {
        Card card = cardService.lock(id);
        return ResponseEntity.ok(card);
    }

    // POST /api/v1/cards/:id/unlock
    @PostMapping("/api/v1/cards/{id}/unlock")
    public ResponseEntity<Card> unlock(@PathVariable UUID id) {
        Card card = cardService.unlock(id);
        return ResponseEntity.ok(card);
    }

    // POST /api/v1/cards/:id/replace
    @PostMapping("/api/v1/cards/{id}/replace")
    public ResponseEntity<Card> replace(
        @PathVariable UUID id,
        @Valid @RequestBody ReplaceCardRequest request
    ) {
        Card card = cardService.replace(id, request.getReason());
        return ResponseEntity.status(HttpStatus.CREATED).body(card);
    }

    // DELETE /api/v1/cards/:id (soft close)
    @DeleteMapping("/api/v1/cards/{id}")
    public ResponseEntity<Card> close(@PathVariable UUID id) {
        Card card = cardService.close(id);
        return ResponseEntity.ok(card);
    }
}
