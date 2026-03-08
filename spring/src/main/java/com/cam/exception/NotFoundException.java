package com.cam.exception;

public class NotFoundException extends AppException {

    public NotFoundException(String resource, Object id) {
        super(resource + " not found: " + id, 404, "NOT_FOUND");
    }

    public NotFoundException(String message) {
        super(message, 404, "NOT_FOUND");
    }
}
