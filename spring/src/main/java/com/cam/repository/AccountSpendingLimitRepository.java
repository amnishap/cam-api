package com.cam.repository;

import com.cam.entity.AccountSpendingLimit;
import com.cam.enums.LimitType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AccountSpendingLimitRepository extends JpaRepository<AccountSpendingLimit, UUID> {

    @Query("SELECT asl FROM AccountSpendingLimit asl WHERE asl.account.id = :accountId ORDER BY asl.createdAt ASC")
    List<AccountSpendingLimit> findByAccountIdOrderByCreatedAtAsc(@Param("accountId") UUID accountId);

    /**
     * Find by accountId + limitType + mccCode, handling the case where mccCode is NULL.
     * When mccCode param is null, match rows where mcc_code IS NULL.
     * When mccCode param is not null, match rows where mcc_code = :mccCode.
     */
    @Query("SELECT asl FROM AccountSpendingLimit asl " +
           "WHERE asl.account.id = :accountId " +
           "AND asl.limitType = :limitType " +
           "AND ((:mccCode IS NULL AND asl.mccCode IS NULL) " +
           "     OR (:mccCode IS NOT NULL AND asl.mccCode = :mccCode))")
    Optional<AccountSpendingLimit> findByAccountIdAndLimitTypeAndMccCode(
        @Param("accountId") UUID accountId,
        @Param("limitType") LimitType limitType,
        @Param("mccCode") String mccCode
    );
}
