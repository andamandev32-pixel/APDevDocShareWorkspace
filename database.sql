-- Database Schema for Document Share App (MariaDB)
-- You can run this script in phpMyAdmin to create the table

CREATE TABLE IF NOT EXISTS `share_projects` (
  `id` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `pin` varchar(5) DEFAULT NULL,
  `project_type` varchar(20) NOT NULL,
  `html_content` mediumtext DEFAULT NULL,
  `css_content` mediumtext DEFAULT NULL,
  `js_content` mediumtext DEFAULT NULL,
  `jsx_content` mediumtext DEFAULT NULL,
  `favorite` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
