package com.cam.exception;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.time.Instant;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    record ErrorDetail(String code, String message, int statusCode, String requestId, String timestamp) {}
    record ErrorResponse(ErrorDetail error) {}

    @ExceptionHandler(AppException.class)
    public ResponseEntity<ErrorResponse> handleAppException(AppException ex, HttpServletRequest request) {
        log.warn("AppException [{}]: {}", ex.getErrorCode(), ex.getMessage());
        ErrorResponse body = new ErrorResponse(new ErrorDetail(
            ex.getErrorCode(),
            ex.getMessage(),
            ex.getStatusCode(),
            resolveRequestId(request),
            Instant.now().toString()
        ));
        return ResponseEntity.status(ex.getStatusCode()).body(body);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        String message = ex.getBindingResult().getFieldErrors().stream()
            .map(FieldError::getDefaultMessage)
            .collect(Collectors.joining(", "));
        ErrorResponse body = new ErrorResponse(new ErrorDetail(
            "VALIDATION_ERROR",
            message,
            400,
            resolveRequestId(request),
            Instant.now().toString()
        ));
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException ex, HttpServletRequest request) {
        ErrorResponse body = new ErrorResponse(new ErrorDetail(
            "BAD_REQUEST",
            "Malformed or missing request body",
            400,
            resolveRequestId(request),
            Instant.now().toString()
        ));
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex, HttpServletRequest request) {
        String message = "Invalid value for parameter '" + ex.getName() + "': " + ex.getValue();
        ErrorResponse body = new ErrorResponse(new ErrorDetail(
            "BAD_REQUEST",
            message,
            400,
            resolveRequestId(request),
            Instant.now().toString()
        ));
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex, HttpServletRequest request) {
        log.error("Unhandled exception", ex);
        ErrorResponse body = new ErrorResponse(new ErrorDetail(
            "INTERNAL_SERVER_ERROR",
            "An unexpected error occurred",
            500,
            resolveRequestId(request),
            Instant.now().toString()
        ));
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }

    private String resolveRequestId(HttpServletRequest request) {
        String header = request.getHeader("X-Request-ID");
        return (header != null && !header.isBlank()) ? header : UUID.randomUUID().toString();
    }
}
