package com.cam.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ReplaceCardRequest {

    @NotBlank(message = "reason is required")
    private String reason;
}
