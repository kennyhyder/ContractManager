const { Contract, Template, User } = require('../models');
const elasticsearch = require('@elastic/elasticsearch');
const logger = require('../utils/logger');

class SearchService {
  constructor() {
    this.client = null;
    this.indices = {
      contracts: 'contracts',
      templates: 'templates',
      users: 'users'
    };
  }

  /**
   * Initialize Elasticsearch client
   */
  async initialize() {
    try {
      if (process.env.ELASTICSEARCH_URL) {
        this.client = new elasticsearch.Client({
          node: process.env.ELASTICSEARCH_URL,
          auth: {
            username: process.env.ELASTICSEARCH_USERNAME,
            password: process.env.ELASTICSEARCH_PASSWORD
          }
        });

        // Check connection
        await this.client.ping();
        
        // Create indices if they don't exist
        await this.createIndices();
        
        logger.info('Search service initialized successfully');
      } else {
        logger.warn('Elasticsearch not configured, using database search');
      }
    } catch (error) {
      logger.error('Search service initialization failed:', error);
      this.client = null;
    }
  }

  /**
   * Create indices
   */
  async createIndices() {
    try {
      for (const [key, index] of Object.entries(this.indices)) {
        const exists = await this.client.indices.exists({ index });
        
        if (!exists) {
          await this.client.indices.create({
            index,
            body: this.getIndexMapping(key)
          });
          
          logger.info(`Created index: ${index}`);
        }
      }
    } catch (error) {
      logger.error('Create indices error:', error);
    }
  }

  /**
   * Get index mapping
   */
  getIndexMapping(type) {
    const mappings = {
      contracts: {
        mappings: {
          properties: {
            title: { type: 'text', analyzer: 'standard' },
            content: { type: 'text', analyzer: 'standard' },
            type: { type: 'keyword' },
            status: { type: 'keyword' },
            tags: { type: 'keyword' },
            owner: { type: 'keyword' },
            collaborators: { type: 'keyword' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' }
          }
        }
      },
      templates: {
        mappings: {
          properties: {
            name: { type: 'text', analyzer: 'standard' },
            description: { type: 'text', analyzer: 'standard' },
            content: { type: 'text', analyzer: 'standard' },
            category: { type: 'keyword' },
            tags: { type: 'keyword' },
            isPublic: { type: 'boolean' },
            createdAt: { type: 'date' }
          }
        }
      },
      users: {
        mappings: {
          properties: {
            firstName: { type: 'text' },
            lastName: { type: 'text' },
            email: { type: 'keyword' },
            company: { type: 'text' },
            role: { type: 'keyword' },
            department: { type: 'keyword' },
            isActive: { type: 'boolean' }
          }
        }
      }
    };

    return mappings[type] || {};
  }

  /**
   * Search contracts
   */
  async searchContracts(query, userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        filters = {},
        sort = { createdAt: 'desc' }
      } = options;

      // Use Elasticsearch if available
      if (this.client) {
        return await this.elasticsearchContracts(query, userId, { page, limit, filters, sort });
      }

      // Fallback to database search
      return await this.databaseSearchContracts(query, userId, { page, limit, filters, sort });
    } catch (error) {
      logger.error('Search contracts error:', error);
      throw error;
    }
  }

  /**
   * Elasticsearch contract search
   */
  async elasticsearchContracts(query, userId, options) {
    try {
      const { page, limit, filters, sort } = options;
      const from = (page - 1) * limit;

      // Build query
      const must = [];
      const filter = [];

      // User access filter
      filter.push({
        bool: {
          should: [
            { term: { owner: userId } },
            { term: { collaborators: userId } }
          ]
        }
      });

      // Text search
      if (query) {
        must.push({
          multi_match: {
            query,
            fields: ['title^3', 'content', 'tags^2'],
            type: 'best_fields',
            fuzziness: 'AUTO'
          }
        });
      }

      // Apply filters
      if (filters.type) {
        filter.push({ term: { type: filters.type } });
      }
      if (filters.status) {
        filter.push({ term: { status: filters.status } });
      }
      if (filters.tags?.length) {
        filter.push({ terms: { tags: filters.tags } });
      }
      if (filters.dateFrom || filters.dateTo) {
        const dateFilter = { range: { createdAt: {} } };
        if (filters.dateFrom) dateFilter.range.createdAt.gte = filters.dateFrom;
        if (filters.dateTo) dateFilter.range.createdAt.lte = filters.dateTo;
        filter.push(dateFilter);
      }

      // Execute search
      const response = await this.client.search({
        index: this.indices.contracts,
        body: {
          query: {
            bool: {
              must,
              filter
            }
          },
          sort: Object.entries(sort).map(([field, order]) => ({ [field]: order })),
          from,
          size: limit,
          highlight: {
            fields: {
              title: {},
              content: { fragment_size: 150, number_of_fragments: 3 }
            }
          }
        }
      });

      // Get full documents from database
      const contractIds = response.hits.hits.map(hit => hit._id);
      const contracts = await Contract.find({ _id: { $in: contractIds } })
        .populate('owner', 'firstName lastName email')
        .populate('collaborators.user', 'firstName lastName email')
        .lean();

      // Sort contracts to match Elasticsearch order
      const sortedContracts = contractIds.map(id => 
        contracts.find(c => c._id.toString() === id)
      ).filter(Boolean);

      // Add highlights
      sortedContracts.forEach((contract, index) => {
        const hit = response.hits.hits[index];
        if (hit.highlight) {
          contract.highlights = hit.highlight;
        }
      });

      return {
        contracts: sortedContracts,
        pagination: {
          page,
          limit,
          total: response.hits.total.value,
          pages: Math.ceil(response.hits.total.value / limit)
        }
      };
    } catch (error) {
      logger.error('Elasticsearch contracts error:', error);
      throw error;
    }
  }

  /**
   * Database contract search (fallback)
   */
  async databaseSearchContracts(query, userId, options) {
    try {
      const { page, limit, filters, sort } = options;

      // Build query
      const dbQuery = {
        $and: [
          {
            $or: [
              { owner: userId },
              { 'collaborators.user': userId }
            ]
          },
          { deletedAt: null }
        ]
      };

      // Text search
      if (query) {
        dbQuery.$and.push({
          $or: [
            { title: { $regex: query, $options: 'i' } },
            { content: { $regex: query, $options: 'i' } },
            { tags: { $in: [new RegExp(query, 'i')] } }
          ]
        });
      }

      // Apply filters
      if (filters.type) dbQuery.type = filters.type;
      if (filters.status) dbQuery.status = filters.status;
      if (filters.tags?.length) dbQuery.tags = { $in: filters.tags };
      if (filters.dateFrom || filters.dateTo) {
        dbQuery.createdAt = {};
        if (filters.dateFrom) dbQuery.createdAt.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) dbQuery.createdAt.$lte = new Date(filters.dateTo);
      }

      // Execute query
      const contracts = await Contract
        .find(dbQuery)
        .populate('owner', 'firstName lastName email')
        .populate('collaborators.user', 'firstName lastName email')
        .sort(sort)
        .limit(limit)
        .skip((page - 1) * limit)
        .lean();

      const total = await Contract.countDocuments(dbQuery);

      return {
        contracts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Database search contracts error:', error);
      throw error;
    }
  }

  /**
   * Index contract
   */
  async indexContract(contract) {
    try {
      if (!this.client) return;

      await this.client.index({
        index: this.indices.contracts,
        id: contract._id.toString(),
        body: {
          title: contract.title,
          content: contract.content,
          type: contract.type,
          status: contract.status,
          tags: contract.tags,
          owner: contract.owner.toString(),
          collaborators: contract.collaborators.map(c => c.user.toString()),
          createdAt: contract.createdAt,
          updatedAt: contract.updatedAt
        }
      });

      logger.debug('Contract indexed:', contract._id);
    } catch (error) {
      logger.error('Index contract error:', error);
    }
  }

  /**
   * Update contract in index
   */
  async updateContract(contract) {
    try {
      if (!this.client) return;

      await this.client.update({
        index: this.indices.contracts,
        id: contract._id.toString(),
        body: {
          doc: {
            title: contract.title,
            content: contract.content,
            type: contract.type,
            status: contract.status,
            tags: contract.tags,
            owner: contract.owner.toString(),
            collaborators: contract.collaborators.map(c => c.user.toString()),
            updatedAt: contract.updatedAt
          }
        }
      });

      logger.debug('Contract updated in index:', contract._id);
    } catch (error) {
      logger.error('Update contract in index error:', error);
    }
  }

  /**
   * Remove contract from index
   */
  async removeContract(contractId) {
    try {
      if (!this.client) return;

      await this.client.delete({
        index: this.indices.contracts,
        id: contractId.toString()
      });

      logger.debug('Contract removed from index:', contractId);
    } catch (error) {
      logger.error('Remove contract from index error:', error);
    }
  }

  /**
   * Search templates
   */
  async searchTemplates(query, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        publicOnly = false
      } = options;

      const dbQuery = {};

      if (publicOnly) {
        dbQuery.isPublic = true;
      }

      if (category) {
        dbQuery.category = category;
      }

      if (query) {
        dbQuery.$or = [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ];
      }

      const templates = await Template
        .find(dbQuery)
        .populate('createdBy', 'firstName lastName')
        .sort({ usageCount: -1, createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .lean();

      const total = await Template.countDocuments(dbQuery);

      return {
        templates,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Search templates error:', error);
      throw error;
    }
  }

  /**
   * Search users
   */
  async searchUsers(query, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        role,
        department,
        activeOnly = true
      } = options;

      const dbQuery = {};

      if (activeOnly) {
        dbQuery.isActive = true;
      }

      if (role) {
        dbQuery.role = role;
      }

      if (department) {
        dbQuery.department = department;
      }

      if (query) {
        dbQuery.$or = [
          { firstName: { $regex: query, $options: 'i' } },
          { lastName: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } },
          { company: { $regex: query, $options: 'i' } }
        ];
      }

      const users = await User
        .find(dbQuery)
        .select('firstName lastName email company role department avatar')
        .sort({ firstName: 1, lastName: 1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .lean();

      const total = await User.countDocuments(dbQuery);

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Search users error:', error);
      throw error;
    }
  }

  /**
   * Global search
   */
  async globalSearch(query, userId, options = {}) {
    try {
      const { limit = 10 } = options;

      const [contracts, templates, users] = await Promise.all([
        this.searchContracts(query, userId, { limit }),
        this.searchTemplates(query, { limit, publicOnly: false }),
        this.searchUsers(query, { limit })
      ]);

      return {
        contracts: contracts.contracts,
        templates: templates.templates,
        users: users.users,
        total: contracts.pagination.total + templates.pagination.total + users.pagination.total
      };
    } catch (error) {
      logger.error('Global search error:', error);
      throw error;
    }
  }

  /**
   * Get search suggestions
   */
  async getSearchSuggestions(query, type = 'contracts') {
    try {
      if (!this.client || !query) return [];

      const response = await this.client.search({
        index: this.indices[type],
        body: {
          suggest: {
            suggestions: {
              prefix: query,
              completion: {
                field: 'title.suggest',
                size: 5,
                fuzzy: {
                  fuzziness: 'AUTO'
                }
              }
            }
          }
        }
      });

      return response.suggest.suggestions[0].options.map(option => ({
        text: option.text,
        score: option.score
      }));
    } catch (error) {
      logger.error('Get search suggestions error:', error);
      return [];
    }
  }
}

module.exports = new SearchService();