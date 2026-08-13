-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'DRIVER', 'DISPATCHER', 'EDITOR', 'ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "VerificationPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'PASSWORD_RESET', 'MAGIC_LINK', 'EMAIL_CHANGE');

-- CreateEnum
CREATE TYPE "MfaType" AS ENUM ('TOTP', 'RECOVERY_CODE');

-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('PICKUP', 'DELIVERY', 'BILLING');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContactChannelType" AS ENUM ('HOTLINE', 'PHONE', 'EMAIL', 'ZALO', 'FACEBOOK', 'YOUTUBE', 'TIKTOK', 'OTHER');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'NEED_MORE_INFO', 'QUOTED', 'NEGOTIATING', 'ACCEPTED', 'CONVERTED_TO_SHIPMENT', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequestKind" AS ENUM ('FREIGHT', 'MOVING');

-- CreateEnum
CREATE TYPE "StopKind" AS ENUM ('PICKUP', 'DELIVERY', 'WAYPOINT');

-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('QUARANTINED', 'PROCESSING', 'READY', 'REJECTED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'SENT', 'VIEWED', 'NEGOTIATING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MessageVisibility" AS ENUM ('INTERNAL', 'CUSTOMER_VISIBLE');

-- CreateEnum
CREATE TYPE "VehicleCategory" AS ENUM ('LIGHT_TRUCK', 'MEDIUM_TRUCK', 'HEAVY_TRUCK', 'BOX_TRUCK', 'TARPAULIN_TRUCK', 'SPECIALIZED');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AvailabilityKind" AS ENUM ('MAINTENANCE', 'LEAVE', 'RESERVED', 'OTHER');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('CREATED', 'CONFIRMED', 'SCHEDULED', 'DRIVER_ASSIGNED', 'EN_ROUTE_TO_PICKUP', 'AT_PICKUP', 'PICKUP_INSPECTION', 'PACKING', 'LOADING', 'SECURED_ON_VEHICLE', 'IN_TRANSIT', 'AT_DELIVERY', 'UNLOADING', 'DELIVERED_PENDING_CONFIRMATION', 'COMPLETED', 'ON_HOLD', 'INCIDENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('DRIVER_APP', 'STAFF_PORTAL', 'SYSTEM', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "MediaStage" AS ENUM ('BEFORE_PICKUP', 'PICKUP_INSPECTION', 'PACKING', 'LOADING', 'SECURING', 'IN_TRANSIT', 'UNLOADING', 'DELIVERY', 'DAMAGE_EVIDENCE', 'PROOF_OF_DELIVERY');

-- CreateEnum
CREATE TYPE "MediaVisibility" AS ENUM ('INTERNAL', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('QUARANTINED', 'PROCESSING', 'READY', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeliveryOutcome" AS ENUM ('DELIVERED_FULL', 'DELIVERED_PARTIAL', 'REFUSED');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('DELAY', 'VEHICLE_BREAKDOWN', 'ACCIDENT', 'DAMAGE', 'LOSS', 'ACCESS_ISSUE', 'CUSTOMER_UNAVAILABLE', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'ACTION_REQUIRED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ContactInquiryStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'SPAM');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('QUESTION', 'COMPLAINT', 'COMPENSATION', 'INVOICE', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'WAITING_FOR_STAFF', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REVERSED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'ZALO');

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "DataSubjectRequestType" AS ENUM ('ACCESS', 'RECTIFICATION', 'EXPORT', 'DELETION');

-- CreateEnum
CREATE TYPE "DataSubjectRequestStatus" AS ENUM ('RECEIVED', 'VERIFYING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "emailNormalized" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "phone" TEXT,
    "phoneNormalized" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedById" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "identifier" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "VerificationPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "MfaType" NOT NULL,
    "secretEnc" TEXT NOT NULL,
    "label" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT,
    "taxCode" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "avatarKey" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_addresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AddressType" NOT NULL DEFAULT 'PICKUP',
    "label" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "line" TEXT NOT NULL,
    "ward" TEXT,
    "district" TEXT,
    "province" TEXT NOT NULL,
    "postalCode" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_profile" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "slogan" TEXT,
    "description" TEXT,
    "taxCode" TEXT,
    "businessLicense" TEXT,
    "transportLicense" TEXT,
    "logoKey" TEXT,
    "faviconKey" TEXT,
    "defaultOgImageKey" TEXT,
    "pendingFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'BRANCH',
    "line" TEXT NOT NULL,
    "ward" TEXT,
    "district" TEXT,
    "province" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "phone" TEXT,
    "email" TEXT,
    "workingHours" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_channels" (
    "id" TEXT NOT NULL,
    "type" "ContactChannelType" NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "url" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "coverImageKey" TEXT,
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isMovingService" BOOLEAN NOT NULL DEFAULT false,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_areas" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "district" TEXT,
    "description" TEXT,
    "note" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "static_pages" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "canonicalUrl" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "static_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_sections" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "page" TEXT NOT NULL DEFAULT 'home',
    "title" TEXT,
    "subtitle" TEXT,
    "body" TEXT,
    "config" JSONB,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL DEFAULT 'IMAGE',
    "objectKey" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "checksum" TEXT,
    "altText" TEXT,
    "caption" TEXT,
    "credit" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_tags" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_posts" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT NOT NULL,
    "categoryId" TEXT,
    "coverImageId" TEXT,
    "authorName" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "canonicalUrl" TEXT,
    "socialImageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "RequestKind" NOT NULL DEFAULT 'FREIGHT',
    "userId" TEXT,
    "serviceId" TEXT,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactPhoneNormalized" TEXT NOT NULL,
    "contactEmail" TEXT,
    "companyName" TEXT,
    "requestedVehicleTypeId" TEXT,
    "preferredPickupAt" TIMESTAMP(3),
    "preferredDeliveryAt" TIMESTAMP(3),
    "needsLoading" BOOLEAN NOT NULL DEFAULT false,
    "needsPacking" BOOLEAN NOT NULL DEFAULT false,
    "needsAssembly" BOOLEAN NOT NULL DEFAULT false,
    "needsHoisting" BOOLEAN NOT NULL DEFAULT false,
    "declaredValue" DECIMAL(18,0),
    "note" TEXT,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "guestAccessTokenHash" TEXT,
    "guestTokenExpiresAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_stops" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "kind" "StopKind" NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "line" TEXT NOT NULL,
    "ward" TEXT,
    "district" TEXT,
    "province" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "floorNumber" INTEGER,
    "hasElevator" BOOLEAN,
    "carryDistanceM" INTEGER,
    "accessNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargo_items" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "cargoType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "weightKg" DECIMAL(12,2) NOT NULL,
    "lengthCm" INTEGER,
    "widthCm" INTEGER,
    "heightCm" INTEGER,
    "volumeM3" DECIMAL(10,3),
    "isFragile" BOOLEAN NOT NULL DEFAULT false,
    "isValuable" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cargo_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moving_request_details" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL,
    "originFloor" INTEGER,
    "originHasElevator" BOOLEAN,
    "originCarryDistanceM" INTEGER,
    "destinationFloor" INTEGER,
    "destinationHasElevator" BOOLEAN,
    "destinationCarryDistanceM" INTEGER,
    "preferredDate" TIMESTAMP(3),
    "preferredTimeSlot" TEXT,
    "needsCartons" BOOLEAN NOT NULL DEFAULT false,
    "cartonQuantity" INTEGER,
    "needsPacking" BOOLEAN NOT NULL DEFAULT false,
    "needsDisassembly" BOOLEAN NOT NULL DEFAULT false,
    "needsCleaning" BOOLEAN NOT NULL DEFAULT false,
    "requestsSiteSurvey" BOOLEAN NOT NULL DEFAULT false,
    "surveyScheduledAt" TIMESTAMP(3),
    "surveyCompletedAt" TIMESTAMP(3),
    "surveyNote" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moving_request_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moving_inventory_items" (
    "id" TEXT NOT NULL,
    "movingRequestDetailId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "estimatedLengthCm" INTEGER,
    "estimatedWidthCm" INTEGER,
    "estimatedHeightCm" INTEGER,
    "estimatedWeightKg" DECIMAL(10,2),
    "isFragile" BOOLEAN NOT NULL DEFAULT false,
    "isHighValue" BOOLEAN NOT NULL DEFAULT false,
    "needsDisassembly" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "addedByStaff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moving_inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_attachments" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL DEFAULT 'IMAGE',
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "caption" TEXT,
    "status" "AttachmentStatus" NOT NULL DEFAULT 'QUARANTINED',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_status_events" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "fromStatus" "ServiceRequestStatus",
    "toStatus" "ServiceRequestStatus" NOT NULL,
    "actorId" TEXT,
    "actorRole" "UserRole",
    "reason" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "currentRevisionId" TEXT,
    "acceptedRevisionId" TEXT,
    "preparedById" TEXT,
    "approvedById" TEXT,
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_revisions" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "subtotal" DECIMAL(18,0) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(18,0) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,0) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,0) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "priceCatalogVersionId" TEXT,
    "terms" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),

    CONSTRAINT "quote_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_line_items" (
    "id" TEXT NOT NULL,
    "quoteRevisionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'TRANSPORT',
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(18,0) NOT NULL,
    "discountAmount" DECIMAL(18,0) NOT NULL DEFAULT 0,
    "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(18,0) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_messages" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorRole" "UserRole",
    "visibility" "MessageVisibility" NOT NULL DEFAULT 'CUSTOMER_VISIBLE',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_activities" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" "UserRole",
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_catalogs" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_catalogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_catalog_versions" (
    "id" TEXT NOT NULL,
    "priceCatalogId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "isReferenceOnly" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_catalog_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_rates" (
    "id" TEXT NOT NULL,
    "priceCatalogVersionId" TEXT NOT NULL,
    "vehicleTypeId" TEXT,
    "serviceId" TEXT,
    "priceZoneId" TEXT,
    "unit" TEXT NOT NULL,
    "basePrice" DECIMAL(18,0) NOT NULL,
    "unitPrice" DECIMAL(18,0) NOT NULL DEFAULT 0,
    "minimumKm" DECIMAL(10,2),
    "minimumHours" DECIMAL(6,2),
    "includedKm" DECIMAL(10,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_rates" (
    "id" TEXT NOT NULL,
    "priceCatalogVersionId" TEXT NOT NULL,
    "originProvince" TEXT NOT NULL,
    "destinationProvince" TEXT NOT NULL,
    "vehicleTypeId" TEXT,
    "price" DECIMAL(18,0) NOT NULL,
    "estimatedKm" DECIMAL(10,2),
    "estimatedHours" DECIMAL(6,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_rates" (
    "id" TEXT NOT NULL,
    "priceCatalogVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "price" DECIMAL(18,0) NOT NULL,
    "minimumWorkers" INTEGER,
    "minimumHours" DECIMAL(6,2),
    "safetyNote" TEXT,
    "exclusions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labor_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surcharge_rules" (
    "id" TEXT NOT NULL,
    "priceCatalogVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "calculationType" TEXT NOT NULL DEFAULT 'FIXED',
    "amount" DECIMAL(18,0) NOT NULL DEFAULT 0,
    "percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "unit" TEXT,
    "conditions" JSONB,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "surcharge_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_zones" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_zone_areas" (
    "priceZoneId" TEXT NOT NULL,
    "serviceAreaId" TEXT NOT NULL,

    CONSTRAINT "price_zone_areas_pkey" PRIMARY KEY ("priceZoneId","serviceAreaId")
);

-- CreateTable
CREATE TABLE "vehicle_types" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "VehicleCategory" NOT NULL,
    "description" TEXT,
    "payloadKg" INTEGER,
    "bodyLengthCm" INTEGER,
    "bodyWidthCm" INTEGER,
    "bodyHeightCm" INTEGER,
    "volumeM3" DECIMAL(8,2),
    "bodyType" TEXT,
    "suitableFor" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageKey" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "vehicleTypeId" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "plateNumberNormalized" TEXT NOT NULL,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "brand" TEXT,
    "model" TEXT,
    "manufactureYear" INTEGER,
    "inspectionExpiresAt" TIMESTAMP(3),
    "insuranceExpiresAt" TIMESTAMP(3),
    "internalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_documents" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "documentNumber" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_maintenances" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "odometerKm" INTEGER,
    "cost" DECIMAL(18,0),
    "description" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_maintenances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "workPhone" TEXT NOT NULL,
    "workPhoneNormalized" TEXT NOT NULL,
    "licenseClass" TEXT,
    "licenseNumber" TEXT,
    "licenseExpiresAt" TIMESTAMP(3),
    "status" "DriverStatus" NOT NULL DEFAULT 'ACTIVE',
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "internalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "driver_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_documents" (
    "id" TEXT NOT NULL,
    "driverProfileId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "documentNumber" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_blocks" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT,
    "driverProfileId" TEXT,
    "kind" "AvailabilityKind" NOT NULL DEFAULT 'OTHER',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "trackingCode" TEXT NOT NULL,
    "userId" TEXT,
    "serviceRequestId" TEXT,
    "quoteId" TEXT,
    "vehicleTypeId" TEXT,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'CREATED',
    "scheduledPickupAt" TIMESTAMP(3),
    "actualPickupAt" TIMESTAMP(3),
    "estimatedDeliveryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalAmount" DECIMAL(18,0),
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "locationSharingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "instructions" TEXT,
    "internalNote" TEXT,
    "cancelReasonCode" TEXT,
    "cancelReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_stops" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "kind" "StopKind" NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "line" TEXT NOT NULL,
    "ward" TEXT,
    "district" TEXT,
    "province" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "floorNumber" INTEGER,
    "hasElevator" BOOLEAN,
    "carryDistanceM" INTEGER,
    "accessNote" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_assignments" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "primaryDriverId" TEXT,
    "secondaryDriverId" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "overrideConflict" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "assignedById" TEXT,
    "releasedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_status_events" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "fromStatus" "ShipmentStatus",
    "toStatus" "ShipmentStatus" NOT NULL,
    "actorId" TEXT,
    "actorRole" "UserRole",
    "source" "EventSource" NOT NULL DEFAULT 'SYSTEM',
    "note" TEXT,
    "reasonCode" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_media" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "stage" "MediaStage" NOT NULL,
    "kind" "MediaKind" NOT NULL DEFAULT 'IMAGE',
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "durationSeconds" INTEGER,
    "thumbnailKey" TEXT,
    "posterKey" TEXT,
    "caption" TEXT,
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'INTERNAL',
    "status" "MediaStatus" NOT NULL DEFAULT 'QUARANTINED',
    "rejectReason" TEXT,
    "uploadedById" TEXT,
    "capturedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_pings" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "accuracyM" DECIMAL(8,2),
    "speedKph" DECIMAL(6,2),
    "heading" DECIMAL(6,2),
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_pings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_of_pickups" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "senderName" TEXT,
    "senderRelation" TEXT,
    "signatureKey" TEXT,
    "note" TEXT,
    "packageCount" INTEGER,
    "condition" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),

    CONSTRAINT "proof_of_pickups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_of_deliveries" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "receiverName" TEXT NOT NULL,
    "receiverRelation" TEXT,
    "outcome" "DeliveryOutcome" NOT NULL DEFAULT 'DELIVERED_FULL',
    "exceptionReason" TEXT,
    "signatureKey" TEXT,
    "note" TEXT,
    "condition" TEXT,
    "otpVerifiedAt" TIMESTAMP(3),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),
    "correctionOfId" TEXT,
    "correctionReason" TEXT,

    CONSTRAINT "proof_of_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_otps" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "consumedAt" TIMESTAMP(3),
    "sentToPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "shipmentId" TEXT,
    "type" "IncidentType" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "reportedById" TEXT,
    "assigneeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_media" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL DEFAULT 'IMAGE',
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "caption" TEXT,
    "status" "MediaStatus" NOT NULL DEFAULT 'QUARANTINED',
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_inquiries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "email" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ContactInquiryStatus" NOT NULL DEFAULT 'NEW',
    "assigneeId" TEXT,
    "internalNote" TEXT,
    "source" TEXT NOT NULL DEFAULT 'contact-form',
    "convertedRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "type" "TicketType" NOT NULL DEFAULT 'QUESTION',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "subject" TEXT NOT NULL,
    "assigneeId" TEXT,
    "slaDueAt" TIMESTAMP(3),
    "firstRespondedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorRole" "UserRole",
    "visibility" "MessageVisibility" NOT NULL DEFAULT 'CUSTOMER_VISIBLE',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_attachments" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL DEFAULT 'DOCUMENT',
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "fileName" TEXT,
    "status" "MediaStatus" NOT NULL DEFAULT 'QUARANTINED',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "userId" TEXT,
    "shipmentId" TEXT,
    "quoteId" TEXT,
    "billingName" TEXT NOT NULL,
    "billingTaxCode" TEXT,
    "billingAddress" TEXT,
    "billingEmail" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "subtotal" DECIMAL(18,0) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(18,0) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,0) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,0) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(18,0) NOT NULL DEFAULT 0,
    "balanceAmount" DECIMAL(18,0) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "note" TEXT,
    "internalNote" TEXT,
    "voidReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(18,0) NOT NULL,
    "discountAmount" DECIMAL(18,0) NOT NULL DEFAULT 0,
    "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(18,0) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_records" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(18,0) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "referenceCode" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "attachmentKey" TEXT,
    "recordedById" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reverseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkUrl" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'vi',
    "version" INTEGER NOT NULL DEFAULT 1,
    "subject" TEXT,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" TIMESTAMP(3),
    "lastError" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" "UserRole",
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "userId" TEXT,
    "requestHash" TEXT NOT NULL,
    "responseCode" INTEGER,
    "responseBody" JSONB,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "consentType" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_subject_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "DataSubjectRequestType" NOT NULL,
    "status" "DataSubjectRequestStatus" NOT NULL DEFAULT 'RECEIVED',
    "contactEmail" TEXT NOT NULL,
    "note" TEXT,
    "handledById" TEXT,
    "resolution" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_subject_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "_NewsPostTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_NewsPostTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_emailNormalized_key" ON "users"("emailNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNormalized_key" ON "users"("phoneNormalized");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "user_role_assignments_role_revokedAt_idx" ON "user_role_assignments"("role", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_assignments_userId_role_key" ON "user_role_assignments"("userId", "role");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_providerId_accountId_key" ON "accounts"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_revokedAt_idx" ON "sessions"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "verifications_tokenHash_key" ON "verifications"("tokenHash");

-- CreateIndex
CREATE INDEX "verifications_identifier_purpose_idx" ON "verifications"("identifier", "purpose");

-- CreateIndex
CREATE INDEX "verifications_expiresAt_idx" ON "verifications"("expiresAt");

-- CreateIndex
CREATE INDEX "mfa_credentials_userId_type_idx" ON "mfa_credentials"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE INDEX "user_addresses_userId_type_deletedAt_idx" ON "user_addresses"("userId", "type", "deletedAt");

-- CreateIndex
CREATE INDEX "offices_isPublic_sortOrder_idx" ON "offices"("isPublic", "sortOrder");

-- CreateIndex
CREATE INDEX "contact_channels_isActive_sortOrder_idx" ON "contact_channels"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "contact_channels_type_isActive_idx" ON "contact_channels"("type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");

-- CreateIndex
CREATE INDEX "services_status_sortOrder_idx" ON "services"("status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "service_areas_slug_key" ON "service_areas"("slug");

-- CreateIndex
CREATE INDEX "service_areas_status_province_idx" ON "service_areas"("status", "province");

-- CreateIndex
CREATE INDEX "faqs_status_sortOrder_idx" ON "faqs"("status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "static_pages_slug_key" ON "static_pages"("slug");

-- CreateIndex
CREATE INDEX "static_pages_status_idx" ON "static_pages"("status");

-- CreateIndex
CREATE UNIQUE INDEX "site_sections_key_key" ON "site_sections"("key");

-- CreateIndex
CREATE INDEX "site_sections_page_isVisible_sortOrder_idx" ON "site_sections"("page", "isVisible", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_objectKey_key" ON "media_assets"("objectKey");

-- CreateIndex
CREATE INDEX "media_assets_kind_createdAt_idx" ON "media_assets"("kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "news_categories_slug_key" ON "news_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "news_tags_slug_key" ON "news_tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "news_posts_slug_key" ON "news_posts"("slug");

-- CreateIndex
CREATE INDEX "news_posts_status_publishedAt_idx" ON "news_posts"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "news_posts_categoryId_status_idx" ON "news_posts"("categoryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_code_key" ON "service_requests"("code");

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_guestAccessTokenHash_key" ON "service_requests"("guestAccessTokenHash");

-- CreateIndex
CREATE INDEX "service_requests_userId_status_createdAt_idx" ON "service_requests"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "service_requests_status_createdAt_idx" ON "service_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "service_requests_contactPhoneNormalized_idx" ON "service_requests"("contactPhoneNormalized");

-- CreateIndex
CREATE INDEX "request_stops_serviceRequestId_sequence_idx" ON "request_stops"("serviceRequestId", "sequence");

-- CreateIndex
CREATE INDEX "cargo_items_serviceRequestId_idx" ON "cargo_items"("serviceRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "moving_request_details_serviceRequestId_key" ON "moving_request_details"("serviceRequestId");

-- CreateIndex
CREATE INDEX "moving_inventory_items_movingRequestDetailId_category_idx" ON "moving_inventory_items"("movingRequestDetailId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "request_attachments_objectKey_key" ON "request_attachments"("objectKey");

-- CreateIndex
CREATE INDEX "request_attachments_serviceRequestId_status_idx" ON "request_attachments"("serviceRequestId", "status");

-- CreateIndex
CREATE INDEX "request_status_events_serviceRequestId_occurredAt_idx" ON "request_status_events"("serviceRequestId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_code_key" ON "quotes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_currentRevisionId_key" ON "quotes"("currentRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_acceptedRevisionId_key" ON "quotes"("acceptedRevisionId");

-- CreateIndex
CREATE INDEX "quotes_serviceRequestId_status_idx" ON "quotes"("serviceRequestId", "status");

-- CreateIndex
CREATE INDEX "quotes_status_createdAt_idx" ON "quotes"("status", "createdAt");

-- CreateIndex
CREATE INDEX "quote_revisions_quoteId_createdAt_idx" ON "quote_revisions"("quoteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "quote_revisions_quoteId_revisionNumber_key" ON "quote_revisions"("quoteId", "revisionNumber");

-- CreateIndex
CREATE INDEX "quote_line_items_quoteRevisionId_sequence_idx" ON "quote_line_items"("quoteRevisionId", "sequence");

-- CreateIndex
CREATE INDEX "quote_messages_quoteId_createdAt_idx" ON "quote_messages"("quoteId", "createdAt");

-- CreateIndex
CREATE INDEX "quote_activities_quoteId_occurredAt_idx" ON "quote_activities"("quoteId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "price_catalogs_slug_key" ON "price_catalogs"("slug");

-- CreateIndex
CREATE INDEX "price_catalog_versions_status_effectiveFrom_idx" ON "price_catalog_versions"("status", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "price_catalog_versions_priceCatalogId_versionNumber_key" ON "price_catalog_versions"("priceCatalogId", "versionNumber");

-- CreateIndex
CREATE INDEX "vehicle_rates_priceCatalogVersionId_vehicleTypeId_idx" ON "vehicle_rates"("priceCatalogVersionId", "vehicleTypeId");

-- CreateIndex
CREATE INDEX "route_rates_priceCatalogVersionId_originProvince_destinatio_idx" ON "route_rates"("priceCatalogVersionId", "originProvince", "destinationProvince");

-- CreateIndex
CREATE INDEX "labor_rates_priceCatalogVersionId_idx" ON "labor_rates"("priceCatalogVersionId");

-- CreateIndex
CREATE INDEX "surcharge_rules_priceCatalogVersionId_isActive_idx" ON "surcharge_rules"("priceCatalogVersionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "surcharge_rules_priceCatalogVersionId_code_key" ON "surcharge_rules"("priceCatalogVersionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "price_zones_slug_key" ON "price_zones"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_types_slug_key" ON "vehicle_types"("slug");

-- CreateIndex
CREATE INDEX "vehicle_types_status_sortOrder_idx" ON "vehicle_types"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "vehicle_types_category_idx" ON "vehicle_types"("category");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plateNumberNormalized_key" ON "vehicles"("plateNumberNormalized");

-- CreateIndex
CREATE INDEX "vehicles_status_vehicleTypeId_idx" ON "vehicles"("status", "vehicleTypeId");

-- CreateIndex
CREATE INDEX "vehicles_inspectionExpiresAt_idx" ON "vehicles"("inspectionExpiresAt");

-- CreateIndex
CREATE INDEX "vehicles_insuranceExpiresAt_idx" ON "vehicles"("insuranceExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_documents_objectKey_key" ON "vehicle_documents"("objectKey");

-- CreateIndex
CREATE INDEX "vehicle_documents_vehicleId_kind_idx" ON "vehicle_documents"("vehicleId", "kind");

-- CreateIndex
CREATE INDEX "vehicle_documents_expiresAt_idx" ON "vehicle_documents"("expiresAt");

-- CreateIndex
CREATE INDEX "vehicle_maintenances_vehicleId_scheduledAt_idx" ON "vehicle_maintenances"("vehicleId", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "driver_profiles_userId_key" ON "driver_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "driver_profiles_employeeCode_key" ON "driver_profiles"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "driver_profiles_workPhoneNormalized_key" ON "driver_profiles"("workPhoneNormalized");

-- CreateIndex
CREATE INDEX "driver_profiles_status_idx" ON "driver_profiles"("status");

-- CreateIndex
CREATE INDEX "driver_profiles_licenseExpiresAt_idx" ON "driver_profiles"("licenseExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "driver_documents_objectKey_key" ON "driver_documents"("objectKey");

-- CreateIndex
CREATE INDEX "driver_documents_driverProfileId_kind_idx" ON "driver_documents"("driverProfileId", "kind");

-- CreateIndex
CREATE INDEX "driver_documents_expiresAt_idx" ON "driver_documents"("expiresAt");

-- CreateIndex
CREATE INDEX "availability_blocks_vehicleId_startsAt_endsAt_idx" ON "availability_blocks"("vehicleId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "availability_blocks_driverProfileId_startsAt_endsAt_idx" ON "availability_blocks"("driverProfileId", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_trackingCode_key" ON "shipments"("trackingCode");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_serviceRequestId_key" ON "shipments"("serviceRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_quoteId_key" ON "shipments"("quoteId");

-- CreateIndex
CREATE INDEX "shipments_userId_status_createdAt_idx" ON "shipments"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "shipments_status_scheduledPickupAt_idx" ON "shipments"("status", "scheduledPickupAt");

-- CreateIndex
CREATE INDEX "shipments_createdAt_idx" ON "shipments"("createdAt");

-- CreateIndex
CREATE INDEX "shipment_stops_shipmentId_sequence_idx" ON "shipment_stops"("shipmentId", "sequence");

-- CreateIndex
CREATE INDEX "shipment_assignments_shipmentId_isActive_idx" ON "shipment_assignments"("shipmentId", "isActive");

-- CreateIndex
CREATE INDEX "shipment_assignments_vehicleId_isActive_effectiveFrom_effec_idx" ON "shipment_assignments"("vehicleId", "isActive", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "shipment_assignments_primaryDriverId_isActive_effectiveFrom_idx" ON "shipment_assignments"("primaryDriverId", "isActive", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "shipment_status_events_shipmentId_occurredAt_idx" ON "shipment_status_events"("shipmentId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_media_objectKey_key" ON "shipment_media"("objectKey");

-- CreateIndex
CREATE INDEX "shipment_media_shipmentId_stage_status_idx" ON "shipment_media"("shipmentId", "stage", "status");

-- CreateIndex
CREATE INDEX "shipment_media_shipmentId_visibility_status_idx" ON "shipment_media"("shipmentId", "visibility", "status");

-- CreateIndex
CREATE INDEX "location_pings_shipmentId_recordedAt_idx" ON "location_pings"("shipmentId", "recordedAt");

-- CreateIndex
CREATE INDEX "location_pings_recordedAt_idx" ON "location_pings"("recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "proof_of_pickups_shipmentId_key" ON "proof_of_pickups"("shipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "proof_of_deliveries_shipmentId_key" ON "proof_of_deliveries"("shipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "proof_of_deliveries_correctionOfId_key" ON "proof_of_deliveries"("correctionOfId");

-- CreateIndex
CREATE INDEX "delivery_otps_shipmentId_expiresAt_idx" ON "delivery_otps"("shipmentId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_code_key" ON "incidents"("code");

-- CreateIndex
CREATE INDEX "incidents_status_severity_createdAt_idx" ON "incidents"("status", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "incidents_shipmentId_idx" ON "incidents"("shipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "incident_media_objectKey_key" ON "incident_media"("objectKey");

-- CreateIndex
CREATE INDEX "incident_media_incidentId_status_idx" ON "incident_media"("incidentId", "status");

-- CreateIndex
CREATE INDEX "contact_inquiries_status_createdAt_idx" ON "contact_inquiries"("status", "createdAt");

-- CreateIndex
CREATE INDEX "contact_inquiries_phoneNormalized_idx" ON "contact_inquiries"("phoneNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_code_key" ON "support_tickets"("code");

-- CreateIndex
CREATE INDEX "support_tickets_userId_status_idx" ON "support_tickets"("userId", "status");

-- CreateIndex
CREATE INDEX "support_tickets_status_priority_createdAt_idx" ON "support_tickets"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "support_tickets_assigneeId_status_idx" ON "support_tickets"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "ticket_messages_ticketId_createdAt_idx" ON "ticket_messages"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_attachments_objectKey_key" ON "ticket_attachments"("objectKey");

-- CreateIndex
CREATE INDEX "ticket_attachments_messageId_idx" ON "ticket_attachments"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_userId_status_idx" ON "invoices"("userId", "status");

-- CreateIndex
CREATE INDEX "invoices_status_dueAt_idx" ON "invoices"("status", "dueAt");

-- CreateIndex
CREATE INDEX "invoice_lines_invoiceId_sequence_idx" ON "invoice_lines"("invoiceId", "sequence");

-- CreateIndex
CREATE INDEX "payment_records_invoiceId_status_idx" ON "payment_records"("invoiceId", "status");

-- CreateIndex
CREATE INDEX "payment_records_paidAt_idx" ON "payment_records"("paidAt");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_createdAt_idx" ON "notifications"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_eventKey_channel_key" ON "notification_preferences"("userId", "eventKey", "channel");

-- CreateIndex
CREATE INDEX "notification_templates_eventKey_channel_isActive_idx" ON "notification_templates"("eventKey", "channel", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_eventKey_channel_locale_version_key" ON "notification_templates"("eventKey", "channel", "locale", "version");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_idempotencyKey_key" ON "outbox_events"("idempotencyKey");

-- CreateIndex
CREATE INDEX "outbox_events_status_nextRetryAt_idx" ON "outbox_events"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "outbox_events_aggregateType_aggregateId_idx" ON "outbox_events"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_createdAt_idx" ON "audit_logs"("resourceType", "resourceId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "idempotency_records_expiresAt_idx" ON "idempotency_records"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_key_endpoint_key" ON "idempotency_records"("key", "endpoint");

-- CreateIndex
CREATE INDEX "consent_records_userId_consentType_idx" ON "consent_records"("userId", "consentType");

-- CreateIndex
CREATE INDEX "data_subject_requests_status_createdAt_idx" ON "data_subject_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "system_settings_isPublic_idx" ON "system_settings"("isPublic");

-- CreateIndex
CREATE INDEX "_NewsPostTags_B_index" ON "_NewsPostTags"("B");

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_credentials" ADD CONSTRAINT "mfa_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "news_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_requestedVehicleTypeId_fkey" FOREIGN KEY ("requestedVehicleTypeId") REFERENCES "vehicle_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_stops" ADD CONSTRAINT "request_stops_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_items" ADD CONSTRAINT "cargo_items_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moving_request_details" ADD CONSTRAINT "moving_request_details_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moving_inventory_items" ADD CONSTRAINT "moving_inventory_items_movingRequestDetailId_fkey" FOREIGN KEY ("movingRequestDetailId") REFERENCES "moving_request_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_attachments" ADD CONSTRAINT "request_attachments_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_status_events" ADD CONSTRAINT "request_status_events_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "quote_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_acceptedRevisionId_fkey" FOREIGN KEY ("acceptedRevisionId") REFERENCES "quote_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_revisions" ADD CONSTRAINT "quote_revisions_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_revisions" ADD CONSTRAINT "quote_revisions_priceCatalogVersionId_fkey" FOREIGN KEY ("priceCatalogVersionId") REFERENCES "price_catalog_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quoteRevisionId_fkey" FOREIGN KEY ("quoteRevisionId") REFERENCES "quote_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_messages" ADD CONSTRAINT "quote_messages_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_activities" ADD CONSTRAINT "quote_activities_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_catalog_versions" ADD CONSTRAINT "price_catalog_versions_priceCatalogId_fkey" FOREIGN KEY ("priceCatalogId") REFERENCES "price_catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_rates" ADD CONSTRAINT "vehicle_rates_priceCatalogVersionId_fkey" FOREIGN KEY ("priceCatalogVersionId") REFERENCES "price_catalog_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_rates" ADD CONSTRAINT "vehicle_rates_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "vehicle_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_rates" ADD CONSTRAINT "vehicle_rates_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_rates" ADD CONSTRAINT "vehicle_rates_priceZoneId_fkey" FOREIGN KEY ("priceZoneId") REFERENCES "price_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_rates" ADD CONSTRAINT "route_rates_priceCatalogVersionId_fkey" FOREIGN KEY ("priceCatalogVersionId") REFERENCES "price_catalog_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_rates" ADD CONSTRAINT "route_rates_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "vehicle_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_rates" ADD CONSTRAINT "labor_rates_priceCatalogVersionId_fkey" FOREIGN KEY ("priceCatalogVersionId") REFERENCES "price_catalog_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surcharge_rules" ADD CONSTRAINT "surcharge_rules_priceCatalogVersionId_fkey" FOREIGN KEY ("priceCatalogVersionId") REFERENCES "price_catalog_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_zone_areas" ADD CONSTRAINT "price_zone_areas_priceZoneId_fkey" FOREIGN KEY ("priceZoneId") REFERENCES "price_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_zone_areas" ADD CONSTRAINT "price_zone_areas_serviceAreaId_fkey" FOREIGN KEY ("serviceAreaId") REFERENCES "service_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "vehicle_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_maintenances" ADD CONSTRAINT "vehicle_maintenances_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "driver_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "driver_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "vehicle_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_stops" ADD CONSTRAINT "shipment_stops_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_assignments" ADD CONSTRAINT "shipment_assignments_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_assignments" ADD CONSTRAINT "shipment_assignments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_assignments" ADD CONSTRAINT "shipment_assignments_primaryDriverId_fkey" FOREIGN KEY ("primaryDriverId") REFERENCES "driver_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_assignments" ADD CONSTRAINT "shipment_assignments_secondaryDriverId_fkey" FOREIGN KEY ("secondaryDriverId") REFERENCES "driver_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_status_events" ADD CONSTRAINT "shipment_status_events_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_media" ADD CONSTRAINT "shipment_media_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_media" ADD CONSTRAINT "shipment_media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_pings" ADD CONSTRAINT "location_pings_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_pings" ADD CONSTRAINT "location_pings_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "shipment_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_of_pickups" ADD CONSTRAINT "proof_of_pickups_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_of_deliveries" ADD CONSTRAINT "proof_of_deliveries_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_of_deliveries" ADD CONSTRAINT "proof_of_deliveries_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "proof_of_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_otps" ADD CONSTRAINT "delivery_otps_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_media" ADD CONSTRAINT "incident_media_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ticket_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_NewsPostTags" ADD CONSTRAINT "_NewsPostTags_A_fkey" FOREIGN KEY ("A") REFERENCES "news_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_NewsPostTags" ADD CONSTRAINT "_NewsPostTags_B_fkey" FOREIGN KEY ("B") REFERENCES "news_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- CHECK CONSTRAINT bổ sung thủ công (§24.9)
-- Prisma schema chưa biểu đạt được các ràng buộc dưới đây nên thêm bằng SQL.
-- =============================================================================

-- Tiền không được âm ------------------------------------------------------
ALTER TABLE "quote_revisions"
  ADD CONSTRAINT "quote_revisions_amounts_non_negative"
  CHECK ("subtotal" >= 0 AND "discountAmount" >= 0 AND "taxAmount" >= 0 AND "totalAmount" >= 0);

ALTER TABLE "quote_line_items"
  ADD CONSTRAINT "quote_line_items_amounts_non_negative"
  CHECK ("unitPrice" >= 0 AND "discountAmount" >= 0 AND "lineTotal" >= 0 AND "quantity" > 0);

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_amounts_non_negative"
  CHECK ("subtotal" >= 0 AND "discountAmount" >= 0 AND "taxAmount" >= 0
     AND "totalAmount" >= 0 AND "paidAmount" >= 0);

ALTER TABLE "invoice_lines"
  ADD CONSTRAINT "invoice_lines_amounts_non_negative"
  CHECK ("unitPrice" >= 0 AND "discountAmount" >= 0 AND "lineTotal" >= 0 AND "quantity" > 0);

ALTER TABLE "payment_records"
  ADD CONSTRAINT "payment_records_amount_positive"
  CHECK ("amount" > 0);

ALTER TABLE "shipments"
  ADD CONSTRAINT "shipments_total_non_negative"
  CHECK ("totalAmount" IS NULL OR "totalAmount" >= 0);

ALTER TABLE "service_requests"
  ADD CONSTRAINT "service_requests_declared_value_non_negative"
  CHECK ("declaredValue" IS NULL OR "declaredValue" >= 0);

ALTER TABLE "vehicle_rates"
  ADD CONSTRAINT "vehicle_rates_prices_non_negative"
  CHECK ("basePrice" >= 0 AND "unitPrice" >= 0);

ALTER TABLE "route_rates"
  ADD CONSTRAINT "route_rates_price_non_negative"
  CHECK ("price" >= 0);

ALTER TABLE "labor_rates"
  ADD CONSTRAINT "labor_rates_price_non_negative"
  CHECK ("price" >= 0);

-- Toạ độ trong biên hợp lệ -------------------------------------------------
ALTER TABLE "user_addresses"
  ADD CONSTRAINT "user_addresses_coordinates_valid"
  CHECK (("latitude" IS NULL AND "longitude" IS NULL)
      OR ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180));

ALTER TABLE "offices"
  ADD CONSTRAINT "offices_coordinates_valid"
  CHECK (("latitude" IS NULL AND "longitude" IS NULL)
      OR ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180));

ALTER TABLE "request_stops"
  ADD CONSTRAINT "request_stops_coordinates_valid"
  CHECK (("latitude" IS NULL AND "longitude" IS NULL)
      OR ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180));

ALTER TABLE "shipment_stops"
  ADD CONSTRAINT "shipment_stops_coordinates_valid"
  CHECK (("latitude" IS NULL AND "longitude" IS NULL)
      OR ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180));

ALTER TABLE "location_pings"
  ADD CONSTRAINT "location_pings_coordinates_valid"
  CHECK ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180);

ALTER TABLE "location_pings"
  ADD CONSTRAINT "location_pings_accuracy_non_negative"
  CHECK ("accuracyM" IS NULL OR "accuracyM" >= 0);

-- Khoảng thời gian hợp lệ --------------------------------------------------
ALTER TABLE "availability_blocks"
  ADD CONSTRAINT "availability_blocks_time_window_valid"
  CHECK ("startsAt" < "endsAt");

ALTER TABLE "availability_blocks"
  ADD CONSTRAINT "availability_blocks_target_required"
  CHECK ("vehicleId" IS NOT NULL OR "driverProfileId" IS NOT NULL);

ALTER TABLE "shipment_assignments"
  ADD CONSTRAINT "shipment_assignments_time_window_valid"
  CHECK ("effectiveFrom" < "effectiveTo");

ALTER TABLE "price_catalog_versions"
  ADD CONSTRAINT "price_catalog_versions_period_valid"
  CHECK ("effectiveTo" IS NULL OR "effectiveFrom" < "effectiveTo");

-- Số lượng và khối lượng ---------------------------------------------------
ALTER TABLE "cargo_items"
  ADD CONSTRAINT "cargo_items_quantity_weight_positive"
  CHECK ("quantity" > 0 AND "weightKg" >= 0);

ALTER TABLE "moving_inventory_items"
  ADD CONSTRAINT "moving_inventory_items_quantity_positive"
  CHECK ("quantity" > 0);

-- Kích thước tệp phải dương ------------------------------------------------
ALTER TABLE "shipment_media"
  ADD CONSTRAINT "shipment_media_size_positive"
  CHECK ("sizeBytes" > 0);

ALTER TABLE "request_attachments"
  ADD CONSTRAINT "request_attachments_size_positive"
  CHECK ("sizeBytes" > 0);

-- Chống double-booking ở tầng database (§14.3, §24.9) ----------------------
-- Prisma không biểu đạt được EXCLUDE constraint nên viết thủ công.
-- btree_gist cho phép kết hợp so sánh bằng (=) với so sánh giao nhau (&&).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Một xe không thể nằm trong hai phân công còn hiệu lực có thời gian giao nhau.
ALTER TABLE "shipment_assignments"
  ADD CONSTRAINT "shipment_assignments_vehicle_no_overlap"
  EXCLUDE USING gist (
    "vehicleId" WITH =,
    tsrange("effectiveFrom", "effectiveTo", '[)') WITH &&
  ) WHERE ("isActive" AND "vehicleId" IS NOT NULL AND NOT "overrideConflict");

-- Tương tự cho tài xế chính.
ALTER TABLE "shipment_assignments"
  ADD CONSTRAINT "shipment_assignments_driver_no_overlap"
  EXCLUDE USING gist (
    "primaryDriverId" WITH =,
    tsrange("effectiveFrom", "effectiveTo", '[)') WITH &&
  ) WHERE ("isActive" AND "primaryDriverId" IS NOT NULL AND NOT "overrideConflict");
