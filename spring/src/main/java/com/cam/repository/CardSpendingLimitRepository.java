package com.cam.repository;

import com.cam.entity.CardSpendingLimit;
import com.cam.enums.LimitType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CardSpendingLimitRepository extends JpaRepository<CardSpendingLimit, UUID> {

    @Query("SELECT csl FROM CardSpendingLimit csl WHERE csl.card.id = :cardId ORDER BY csl.createdAt ASC")
    List<CardSpendingLimit> findByCardIdOrderByCreatedAtAsc(@Param("cardId") UUID cardId);

    /**
     * Find by cardId + limitType + mccCode, handling the case where mccCode is NULL.
     */
    @Query("SELECT csl FROM CardSpendingLimit csl " +
           "WHERE csl.card.id = :cardId " +
           "AND csl.limitType = :limitType " +
           "AND ((:mccCode IS NULL AND csl.mccCode IS NULL) " +
           "     OR (:mccCode IS NOT NULL AND csl.mccCode = :mccCode))")
    Optional<CardSpendingLimit> findByCardIdAndLimitTypeAndMccCode(
        @Param("cardId") UUID cardId,
        @Param("limitType") LimitType limitType,
        @Param("mccCode") String mccCode
    );
}
