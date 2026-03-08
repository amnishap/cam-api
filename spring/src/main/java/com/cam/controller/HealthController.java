package com.cam.controller;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/health")
@RequiredArgsConstructor
public class HealthController {

    private final EntityManager entityManager;

    // GET /health — liveness
    @GetMapping
    public ResponseEntity<Map<String, Object>> liveness() {
        return ResponseEntity.ok(Map.of(
            "status", "ok",
            "timestamp", Instant.now().toString()
        ));
    }

    // GET /health/ready — readiness (DB ping)
    @GetMapping("/ready")
    public ResponseEntity<Map<String, Object>> readiness() {
        try {
            entityManager.createNativeQuery("SELECT 1").getSingleResult();
            return ResponseEntity.ok(Map.of(
                "status", "ok",
                "timestamp", Instant.now().toString(),
                "database", "connected"
            ));
        } catch (Exception e) {
            log.error("Health readiness check failed", e);
            return ResponseEntity.status(503).body(Map.of(
                "status", "error",
                "timestamp", Instant.now().toString(),
                "database", "disconnected"
            ));
        }
    }
}
