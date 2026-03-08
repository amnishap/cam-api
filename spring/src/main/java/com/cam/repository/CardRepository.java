package com.cam.repository;

import com.cam.entity.Card;
import com.cam.enums.CardStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface CardRepository extends JpaRepository<Card, UUID> {

    @Query("SELECT c FROM Card c WHERE c.account.id = :accountId ORDER BY c.createdAt ASC, c.id ASC")
    List<Card> findByAccountId(@Param("accountId") UUID accountId, Pageable pageable);

    @Query("SELECT c FROM Card c WHERE c.account.id = :accountId " +
           "AND (c.createdAt > :cursorCreatedAt " +
           "     OR (c.createdAt = :cursorCreatedAt AND c.id > :cursorId)) " +
           "ORDER BY c.createdAt ASC, c.id ASC")
    List<Card> findByAccountIdAfterCursor(
        @Param("accountId") UUID accountId,
        @Param("cursorCreatedAt") LocalDateTime cursorCreatedAt,
        @Param("cursorId") UUID cursorId,
        Pageable pageable
    );

    @Query("SELECT COUNT(c) FROM Card c WHERE c.account.id = :accountId AND c.status <> :status")
    long countByAccountIdAndStatusNot(@Param("accountId") UUID accountId, @Param("status") CardStatus status);

    @Query("SELECT c FROM Card c WHERE c.account.id = :accountId AND c.status <> :closedStatus")
    List<Card> findActiveCardsByAccountId(@Param("accountId") UUID accountId, @Param("closedStatus") CardStatus closedStatus);
}
