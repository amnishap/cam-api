package com.cam.dto;

import com.cam.enums.LimitType;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SpendingLimitItem {

    @NotNull(message = "limitType is required")
    private LimitType limitType;

    private Long valueCents;

    private String mccCode;
}
