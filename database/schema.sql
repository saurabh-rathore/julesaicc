CREATE DATABASE IF NOT EXISTS ai_call_center CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE ai_call_center;

-- Admin users for the UI
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(25) NOT NULL PRIMARY KEY, -- Using CUID
  `username` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) UNIQUE,
  `role` ENUM('admin', 'agent') DEFAULT 'agent', -- 'agent' could be for human agents if UI expands
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Call records
CREATE TABLE IF NOT EXISTS `calls` (
  `id` VARCHAR(25) NOT NULL PRIMARY KEY, -- Using CUID
  `customer_phone_number` VARCHAR(50), -- Masked or full, based on privacy requirements
  `sip_call_id` VARCHAR(255) UNIQUE, -- From Asterisk
  `start_time` TIMESTAMP NULL,
  `end_time` TIMESTAMP NULL,
  `status` ENUM('initiated', 'ringing', 'answered_ai', 'answered_human', 'in_progress_ai', 'in_progress_human', 'escalated', 'completed', 'failed', 'missed') NOT NULL,
  `direction` ENUM('inbound', 'outbound') DEFAULT 'inbound',
  `initial_language_preference` VARCHAR(10) COMMENT 'e.g., en, es, fr',
  `final_disposition` VARCHAR(255) COMMENT 'e.g., resolved, issue_pending, escalation_required',
  `recording_url` VARCHAR(512) COMMENT 'URL to the call recording if available',
  `escalated_to_agent_id` VARCHAR(25) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`escalated_to_agent_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Call transcripts with speaker and timing
CREATE TABLE IF NOT EXISTS `transcripts` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `call_id` VARCHAR(25) NOT NULL,
  `speaker` ENUM('customer', 'ai', 'human_agent') NOT NULL,
  `text` TEXT NOT NULL,
  `timestamp_start` DECIMAL(10, 3) COMMENT 'Seconds from the beginning of the call part',
  `timestamp_end` DECIMAL(10, 3) COMMENT 'Seconds from the beginning of the call part',
  `language` VARCHAR(10) COMMENT 'Language of this specific segment',
  `confidence_score` DECIMAL(4,3) COMMENT 'Confidence from STT if available',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`call_id`) REFERENCES `calls`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Feedback on call quality and resolution
CREATE TABLE IF NOT EXISTS `feedback` (
  `id` VARCHAR(25) NOT NULL PRIMARY KEY, -- Using CUID
  `call_id` VARCHAR(25) NOT NULL,
  `rating` TINYINT UNSIGNED COMMENT 'e.g., 1-5 stars',
  `comments` TEXT,
  `customer_expressed_satisfaction` BOOLEAN DEFAULT NULL,
  `collected_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_feedback_call_id` (`call_id`), -- Assuming one feedback entry per call
  FOREIGN KEY (`call_id`) REFERENCES `calls`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer plans (mock table for lookup)
CREATE TABLE IF NOT EXISTS `customer_plans` (
  `id` VARCHAR(25) NOT NULL PRIMARY KEY, -- CUID for the record itself
  `customer_identifier` VARCHAR(255) NOT NULL UNIQUE COMMENT 'e.g., phone number, account ID',
  `plan_name` VARCHAR(255) NOT NULL,
  `plan_details` JSON COMMENT 'Store various plan attributes as JSON',
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Example: Index for faster customer plan lookups
CREATE INDEX idx_customer_identifier ON customer_plans(customer_identifier);
CREATE INDEX idx_call_start_time ON calls(start_time);
CREATE INDEX idx_call_status ON calls(status);

-- Note: CUIDs are variable length, up to 25 chars typically.
-- Consider implications if using fixed-length CHAR(25) vs VARCHAR(25).
-- VARCHAR is generally more flexible for CUIDs.

-- Seed some data (optional, for development)
-- INSERT INTO `users` (`id`, `username`, `password_hash`, `email`, `role`) VALUES
-- ('clxmg3jk0000008l3g4z3h2q1', 'admin', '$2b$10$yourbcryptedarandompasswordhash', 'admin@example.com', 'admin');

-- INSERT INTO `customer_plans` (`id`, `customer_identifier`, `plan_name`, `plan_details`, `is_active`) VALUES
-- ('clxmg3r7k000108l3b4k5c6a2', '+15551234567', 'Premium Unlimited', '{"data_limit_gb": "unlimited", "minutes": "unlimited", "sms": "unlimited", "monthly_cost_usd": 79.99}', TRUE),
-- ('clxmg40xq000208l3fghj2k3l', '+15557654321', 'Basic Talk & Text', '{"data_limit_gb": 1, "minutes": 500, "sms": "unlimited", "monthly_cost_usd": 29.99}', TRUE);
