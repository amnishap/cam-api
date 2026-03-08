package com.cam.exception;

public class BusinessRuleException extends AppException {

    public BusinessRuleException(String errorCode, String message) {
        super(message, 422, errorCode);
    }
}
