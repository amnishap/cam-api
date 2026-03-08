package com.cam.repository;

import com.cam.entity.Account;
import com.cam.enums.AccountStatus;
import com.cam.enums.KycStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AccountRepository extends JpaRepository<Account, UUID> {

    Optional<Account> findByEmail(String email);

    Optional<Account> findByExternalRef(String externalRef);

    boolean existsByEmail(String email);

    boolean existsByExternalRef(String externalRef);

    @Query("SELECT a FROM Account a WHERE (:status IS NULL OR a.status = :status) " +
           "AND (:kycStatus IS NULL OR a.kycStatus = :kycStatus) " +
           "ORDER BY a.createdAt ASC, a.id ASC")
    List<Account> findByFilters(
        @Param("status") AccountStatus status,
        @Param("kycStatus") KycStatus kycStatus,
        Pageable pageable
    );

    /**
     * Cursor pagination: return accounts whose (createdAt, id) is strictly after the cursor row.
     * Matches Prisma's cursor-based pagination behaviour (skip the cursor record and return next N).
     */
    @Query("SELECT a FROM Account a WHERE (:status IS NULL OR a.status = :status) " +
           "AND (:kycStatus IS NULL OR a.kycStatus = :kycStatus) " +
           "AND (a.createdAt > :cursorCreatedAt " +
           "     OR (a.createdAt = :cursorCreatedAt AND a.id > :cursorId)) " +
           "ORDER BY a.createdAt ASC, a.id ASC")
    List<Account> findByFiltersAfterCursor(
        @Param("status") AccountStatus status,
        @Param("kycStatus") KycStatus kycStatus,
        @Param("cursorCreatedAt") LocalDateTime cursorCreatedAt,
        @Param("cursorId") UUID cursorId,
        Pageable pageable
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Account a WHERE a.id = :id")
    Optional<Account> findByIdForUpdate(@Param("id") UUID id);
}
