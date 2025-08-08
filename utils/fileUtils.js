/**
 * File Utilities
 * Helper functions for file operations
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

class FileUtils {
  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.logsDir = path.join(process.cwd(), 'logs');
    this.tempDir = path.join(process.cwd(), 'temp');
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist
   */
  ensureDirectories() {
    try {
      fs.ensureDirSync(this.uploadsDir);
      fs.ensureDirSync(this.logsDir);
      fs.ensureDirSync(this.tempDir);
      
      logger.debug('Directory structure verified', {
        uploads: this.uploadsDir,
        logs: this.logsDir,
        temp: this.tempDir
      });
    } catch (error) {
      logger.error('Failed to create directories', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate unique filename
   * @param {string} originalName - Original filename
   * @param {Object} options - Generation options
   * @returns {string} Unique filename
   */
  generateUniqueFilename(originalName, options = {}) {
    try {
      const ext = path.extname(originalName);
      const baseName = path.basename(originalName, ext);
      const timestamp = Date.now();
      const uuid = uuidv4().substring(0, 8);
      
      if (options.includeOriginal) {
        const safeName = this.sanitizeFilename(baseName);
        return `${timestamp}-${uuid}-${safeName}${ext}`;
      }
      
      return `${timestamp}-${uuid}${ext}`;
    } catch (error) {
      logger.error('Failed to generate unique filename', {
        originalName,
        error: error.message
      });
      return `${Date.now()}-${uuidv4()}${path.extname(originalName)}`;
    }
  }

  /**
   * Sanitize filename to remove unsafe characters
   * @param {string} filename - Filename to sanitize
   * @returns {string} Sanitized filename
   */
  sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return 'unnamed';
    }

    return filename
      // Replace unsafe characters with underscore
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      // Replace spaces with underscores
      .replace(/\s+/g, '_')
      // Remove consecutive underscores
      .replace(/_+/g, '_')
      // Remove leading/trailing underscores
      .replace(/^_+|_+$/g, '')
      // Limit length
      .substring(0, 100)
      // Ensure not empty
      || 'unnamed';
  }

  /**
   * Get file information
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} File information
   */
  async getFileInfo(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const basename = path.basename(filePath);

      return {
        path: filePath,
        name: basename,
        extension: ext,
        size: stats.size,
        sizeFormatted: this.formatFileSize(stats.size),
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        permissions: stats.mode
      };
    } catch (error) {
      logger.error('Failed to get file info', {
        filePath,
        error: error.message
      });
      throw new Error(`Failed to get file information: ${error.message}`);
    }
  }

  /**
   * Calculate file hash
   * @param {string} filePath - Path to file
   * @param {string} algorithm - Hash algorithm (default: sha256)
   * @returns {Promise<string>} File hash
   */
  async calculateFileHash(filePath, algorithm = 'sha256') {
    try {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);

      return new Promise((resolve, reject) => {
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
      });
    } catch (error) {
      logger.error('Failed to calculate file hash', {
        filePath,
        algorithm,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Copy file to destination
   * @param {string} source - Source file path
   * @param {string} destination - Destination path
   * @param {Object} options - Copy options
   * @returns {Promise<string>} Destination path
   */
  async copyFile(source, destination, options = {}) {
    try {
      // Ensure destination directory exists
      const destDir = path.dirname(destination);
      await fs.ensureDir(destDir);

      // Copy file
      await fs.copy(source, destination, {
        overwrite: options.overwrite !== false,
        errorOnExist: options.errorOnExist === true
      });

      logger.debug('File copied successfully', {
        source,
        destination,
        options
      });

      return destination;
    } catch (error) {
      logger.error('Failed to copy file', {
        source,
        destination,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Move file to destination
   * @param {string} source - Source file path
   * @param {string} destination - Destination path
   * @returns {Promise<string>} Destination path
   */
  async moveFile(source, destination) {
    try {
      // Ensure destination directory exists
      const destDir = path.dirname(destination);
      await fs.ensureDir(destDir);

      // Move file
      await fs.move(source, destination, { overwrite: true });

      logger.debug('File moved successfully', {
        source,
        destination
      });

      return destination;
    } catch (error) {
      logger.error('Failed to move file', {
        source,
        destination,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete file safely
   * @param {string} filePath - Path to file
   * @param {Object} options - Delete options
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(filePath, options = {}) {
    try {
      const exists = await fs.pathExists(filePath);
      if (!exists) {
        if (options.ignoreNotFound) {
          return true;
        }
        throw new Error('File not found');
      }

      await fs.unlink(filePath);

      logger.debug('File deleted successfully', { filePath });
      return true;
    } catch (error) {
      logger.error('Failed to delete file', {
        filePath,
        error: error.message
      });
      
      if (options.ignoreErrors) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Clean up old files in directory
   * @param {string} directory - Directory to clean
   * @param {Object} options - Cleanup options
   * @returns {Promise<Object>} Cleanup results
   */
  async cleanupOldFiles(directory, options = {}) {
    try {
      const maxAge = options.maxAge || 24 * 60 * 60 * 1000; // 24 hours default
      const pattern = options.pattern || /\.(tmp|temp)$/;
      const dryRun = options.dryRun === true;

      const files = await fs.readdir(directory);
      const results = {
        scanned: 0,
        deleted: 0,
        errors: 0,
        deletedFiles: [],
        errors: []
      };

      for (const file of files) {
        const filePath = path.join(directory, file);
        
        try {
          const stats = await fs.stat(filePath);
          results.scanned++;

          if (!stats.isFile()) {
            continue;
          }

          // Check if file matches pattern (if provided)
          if (options.pattern && !pattern.test(file)) {
            continue;
          }

          // Check if file is old enough
          const age = Date.now() - stats.mtime.getTime();
          if (age < maxAge) {
            continue;
          }

          if (!dryRun) {
            await fs.unlink(filePath);
          }

          results.deleted++;
          results.deletedFiles.push({
            path: filePath,
            age: Math.round(age / 1000 / 60), // Age in minutes
            size: stats.size
          });

        } catch (fileError) {
          results.errors++;
          results.errors.push({
            file: filePath,
            error: fileError.message
          });
        }
      }

      logger.info('File cleanup completed', {
        directory,
        results,
        dryRun
      });

      return results;
    } catch (error) {
      logger.error('Failed to cleanup files', {
        directory,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Format file size for human reading
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Check if file is PDF
   * @param {string} filePath - Path to file
   * @returns {Promise<boolean>} True if PDF
   */
  async isPDF(filePath) {
    try {
      const buffer = await fs.readFile(filePath, { start: 0, end: 3 });
      return buffer.toString() === '%PDF';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get temporary file path
   * @param {string} extension - File extension
   * @returns {string} Temporary file path
   */
  getTempFilePath(extension = '') {
    const filename = `${uuidv4()}${extension}`;
    return path.join(this.tempDir, filename);
  }

  /**
   * Create backup of file
   * @param {string} filePath - File to backup
   * @returns {Promise<string>} Backup file path
   */
  async createBackup(filePath) {
    try {
      const ext = path.extname(filePath);
      const basename = path.basename(filePath, ext);
      const dirname = path.dirname(filePath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      const backupPath = path.join(dirname, `${basename}.backup.${timestamp}${ext}`);
      await this.copyFile(filePath, backupPath);
      
      return backupPath;
    } catch (error) {
      logger.error('Failed to create backup', {
        filePath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get directory size
   * @param {string} directory - Directory path
   * @returns {Promise<Object>} Directory size info
   */
  async getDirectorySize(directory) {
    try {
      let totalSize = 0;
      let fileCount = 0;
      let dirCount = 0;

      const items = await fs.readdir(directory);

      for (const item of items) {
        const itemPath = path.join(directory, item);
        const stats = await fs.stat(itemPath);

        if (stats.isFile()) {
          totalSize += stats.size;
          fileCount++;
        } else if (stats.isDirectory()) {
          dirCount++;
          const subDirInfo = await this.getDirectorySize(itemPath);
          totalSize += subDirInfo.totalSize;
          fileCount += subDirInfo.fileCount;
          dirCount += subDirInfo.dirCount;
        }
      }

      return {
        totalSize,
        totalSizeFormatted: this.formatFileSize(totalSize),
        fileCount,
        dirCount
      };
    } catch (error) {
      logger.error('Failed to get directory size', {
        directory,
        error: error.message
      });
      throw error;
    }
  }
}

// Create singleton instance
const fileUtils = new FileUtils();

module.exports = fileUtils;