package com.cam.dto;

import com.cam.enums.KycStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateKycRequest {

    @NotNull(message = "kycStatus is required")
    private KycStatus kycStatus;
}
