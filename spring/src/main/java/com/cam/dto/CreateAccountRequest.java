package com.cam.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class CreateAccountRequest {

    @NotBlank(message = "externalRef is required")
    private String externalRef;

    @NotBlank(message = "firstName is required")
    private String firstName;

    @NotBlank(message = "lastName is required")
    private String lastName;

    @NotBlank(message = "email is required")
    @Email(message = "email must be a valid email address")
    private String email;

    private String phone;

    private String dateOfBirth;

    private String taxId;

    private String addressLine1;

    private String addressLine2;

    private String city;

    private String state;

    private String postalCode;

    private String country;

    @NotNull(message = "creditLimitCents is required")
    @Min(value = 0, message = "creditLimitCents must be >= 0")
    private Long creditLimitCents;

    private String currency;
}
