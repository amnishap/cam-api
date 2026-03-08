package com.cam.exception;

import lombok.Getter;

@Getter
public class AppException extends RuntimeException {

    private final int statusCode;
    private final String errorCode;

    public AppException(String message, int statusCode, String errorCode) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
    }

    public AppException(String message, int statusCode, String errorCode, Throwable cause) {
        super(message, cause);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
    }
}
