package com.cam.exception;

public class ConflictException extends AppException {

    public ConflictException(String message) {
        super(message, 409, "CONFLICT");
    }

    public ConflictException(String message, String errorCode) {
        super(message, 409, errorCode);
    }
}
