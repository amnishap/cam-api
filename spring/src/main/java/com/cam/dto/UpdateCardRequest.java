package com.cam.dto;

import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class UpdateCardRequest {

    private String cardholderName;

    @Min(value = 0, message = "dailyLimitCents must be >= 0")
    private Long dailyLimitCents;

    @Min(value = 0, message = "monthlyLimitCents must be >= 0")
    private Long monthlyLimitCents;

    @Min(value = 0, message = "transactionLimitCents must be >= 0")
    private Long transactionLimitCents;
}
