package com.cam.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class PaginatedResponse<T> {

    private List<T> data;
    private Pagination pagination;

    @Data
    @AllArgsConstructor
    public static class Pagination {
        private boolean hasMore;
        private String nextCursor;
        private int limit;
    }

    public static <T> PaginatedResponse<T> of(List<T> items, int limit) {
        boolean hasMore = items.size() > limit;
        List<T> data = hasMore ? items.subList(0, limit) : items;
        String nextCursor = hasMore ? getIdFromLast(data) : null;
        return new PaginatedResponse<>(data, new Pagination(hasMore, nextCursor, limit));
    }

    @SuppressWarnings("unchecked")
    private static <T> String getIdFromLast(List<T> data) {
        if (data.isEmpty()) return null;
        T last = data.get(data.size() - 1);
        try {
            java.lang.reflect.Method getId = last.getClass().getMethod("getId");
            Object id = getId.invoke(last);
            return id != null ? id.toString() : null;
        } catch (Exception e) {
            return null;
        }
    }
}
