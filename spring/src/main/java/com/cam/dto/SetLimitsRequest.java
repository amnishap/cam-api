package com.cam.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class SetLimitsRequest {

    @NotEmpty(message = "limits list must not be empty")
    @Valid
    private List<SpendingLimitItem> limits;
}
