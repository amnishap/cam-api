package com.cam.dto;

import com.cam.enums.CardType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

@Data
public class CreateCardRequest {

    @NotNull(message = "type is required")
    private CardType type;

    @NotBlank(message = "cardholderName is required")
    private String cardholderName;

    private String network;

    @Min(value = 0, message = "dailyLimitCents must be >= 0")
    private Long dailyLimitCents;

    @Min(value = 0, message = "monthlyLimitCents must be >= 0")
    private Long monthlyLimitCents;

    @Min(value = 0, message = "transactionLimitCents must be >= 0")
    private Long transactionLimitCents;

    private Map<String, Object> shippingAddress;
}
