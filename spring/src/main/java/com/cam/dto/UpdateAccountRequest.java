package com.cam.dto;

import com.cam.enums.AccountStatus;
import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class UpdateAccountRequest {

    private AccountStatus status;

    private String phone;

    private String addressLine1;

    private String addressLine2;

    private String city;

    private String state;

    private String postalCode;

    private String country;

    @Min(value = 0, message = "creditLimitCents must be >= 0")
    private Long creditLimitCents;
}
