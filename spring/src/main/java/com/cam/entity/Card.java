package com.cam.entity;

import com.cam.enums.CardStatus;
import com.cam.enums.CardType;
import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "cards")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
@ToString(exclude = {"account", "spendingLimits"})
public class Card {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false)
    private CardType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private CardStatus status;

    @Column(name = "is_locked", nullable = false)
    private boolean locked;

    @Column(name = "last4", nullable = false, length = 4)
    private String last4;

    @Column(name = "masked_pan", nullable = false)
    private String maskedPan;

    @Column(name = "network", nullable = false)
    private String network;

    @Column(name = "expiry_month", nullable = false)
    private Integer expiryMonth;

    @Column(name = "expiry_year", nullable = false)
    private Integer expiryYear;

    @Column(name = "cardholder_name", nullable = false)
    private String cardholderName;

    @Type(JsonBinaryType.class)
    @Column(name = "shipping_address", columnDefinition = "jsonb")
    private Map<String, Object> shippingAddress;

    @Column(name = "daily_limit_cents")
    private Long dailyLimitCents;

    @Column(name = "monthly_limit_cents")
    private Long monthlyLimitCents;

    @Column(name = "transaction_limit_cents")
    private Long transactionLimitCents;

    @Column(name = "activated_at")
    private LocalDateTime activatedAt;

    @Column(name = "deactivated_at")
    private LocalDateTime deactivatedAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "card", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private List<CardSpendingLimit> spendingLimits = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
