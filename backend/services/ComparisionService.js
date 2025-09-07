const { Contract } = require('../models');
const VersionControlService = require('./VersionControlService');
const logger = require('../utils/logger');
const diff = require('diff');
const natural = require('natural');
const similarity = require('string-similarity');

class ComparisonService {
  constructor() {
    this.comparisonTypes = {
      LINE_BY_LINE: 'line_by_line',
      WORD_BY_WORD: 'word_by_word',
      SEMANTIC: 'semantic',
      STRUCTURAL: 'structural'
    };

    this.highlightStyles = {
      ADDED: 'added',
      REMOVED: 'removed',
      MODIFIED: 'modified',
      MOVED: 'moved'
    };
  }

  /**
   * Compare two contracts
   */
  async compareContracts(contractId1, contractId2, options = {}) {
    try {
      const {
        type = this.comparisonTypes.LINE_BY_LINE,
        includeMetadata = true,
        includeStructure = true
      } = options;

      // Get contracts
      const [contract1, contract2] = await Promise.all([
        Contract.findById(contractId1),
        Contract.findById(contractId2)
      ]);

      if (!contract1 || !contract2) {
        throw new Error('Contract not found');
      }

      // Perform comparison
      const comparison = {
        contracts: {
          left: {
            id: contract1._id,
            title: contract1.title,
            version: contract1.currentVersion,
            lastModified: contract1.updatedAt
          },
          right: {
            id: contract2._id,
            title: contract2.title,
            version: contract2.currentVersion,
            lastModified: contract2.updatedAt
          }
        },
        content: await this.compareContent(
          contract1.content,
          contract2.content,
          type
        ),
        similarity: this.calculateSimilarity(contract1.content, contract2.content)
      };

      if (includeMetadata) {
        comparison.metadata = this.compareMetadata(contract1, contract2);
      }

      if (includeStructure) {
        comparison.structure = await this.compareStructure(contract1, contract2);
      }

      return comparison;
    } catch (error) {
      logger.error('Compare contracts error:', error);
      throw error;
    }
  }

  /**
   * Compare contract versions
   */
  async compareVersions(contractId, version1, version2) {
    try {
      return await VersionControlService.compareVersions(
        contractId,
        version1,
        version2
      );
    } catch (error) {
      logger.error('Compare versions error:', error);
      throw error;
    }
  }

  /**
   * Compare content
   */
  async compareContent(content1, content2, type) {
    try {
      switch (type) {
        case this.comparisonTypes.LINE_BY_LINE:
          return this.lineByLineComparison(content1, content2);

        case this.comparisonTypes.WORD_BY_WORD:
          return this.wordByWordComparison(content1, content2);

        case this.comparisonTypes.SEMANTIC:
          return this.semanticComparison(content1, content2);

        case this.comparisonTypes.STRUCTURAL:
          return this.structuralComparison(content1, content2);

        default:
          return this.lineByLineComparison(content1, content2);
      }
    } catch (error) {
      logger.error('Compare content error:', error);
      throw error;
    }
  }

  /**
   * Line by line comparison
   */
  lineByLineComparison(content1, content2) {
    const changes = diff.diffLines(content1, content2);
    const result = {
      changes: [],
      statistics: {
        additions: 0,
        deletions: 0,
        modifications: 0
      }
    };

    let leftLineNumber = 1;
    let rightLineNumber = 1;

    changes.forEach(change => {
      if (change.added) {
        result.statistics.additions += change.count || 1;
        result.changes.push({
          type: this.highlightStyles.ADDED,
          content: change.value,
          lineNumbers: {
            left: null,
            right: rightLineNumber
          }
        });
        rightLineNumber += change.count || 1;
      } else if (change.removed) {
        result.statistics.deletions += change.count || 1;
        result.changes.push({
          type: this.highlightStyles.REMOVED,
          content: change.value,
          lineNumbers: {
            left: leftLineNumber,
            right: null
          }
        });
        leftLineNumber += change.count || 1;
      } else {
        const lineCount = change.count || change.value.split('\n').length - 1;
        result.changes.push({
          type: 'unchanged',
          content: change.value,
          lineNumbers: {
            left: leftLineNumber,
            right: rightLineNumber
          }
        });
        leftLineNumber += lineCount;
        rightLineNumber += lineCount;
      }
    });

    return result;
  }

  /**
   * Word by word comparison
   */
  wordByWordComparison(content1, content2) {
    const changes = diff.diffWords(content1, content2);
    const result = {
      changes: [],
      statistics: {
        wordsAdded: 0,
        wordsRemoved: 0,
        wordsModified: 0
      }
    };

    changes.forEach(change => {
      if (change.added) {
        result.statistics.wordsAdded += change.value.split(/\s+/).length;
        result.changes.push({
          type: this.highlightStyles.ADDED,
          content: change.value
        });
      } else if (change.removed) {
        result.statistics.wordsRemoved += change.value.split(/\s+/).length;
        result.changes.push({
          type: this.highlightStyles.REMOVED,
          content: change.value
        });
      } else {
        result.changes.push({
          type: 'unchanged',
          content: change.value
        });
      }
    });

    return result;
  }

  /**
   * Semantic comparison
   */
  semanticComparison(content1, content2) {
    // Use natural language processing for semantic comparison
    const tokenizer = new natural.WordTokenizer();
    const tokens1 = tokenizer.tokenize(content1.toLowerCase());
    const tokens2 = tokenizer.tokenize(content2.toLowerCase());

    // Calculate TF-IDF
    const tfidf = new natural.TfIdf();
    tfidf.addDocument(tokens1.join(' '));
    tfidf.addDocument(tokens2.join(' '));

    // Find important terms
    const importantTerms1 = [];
    const importantTerms2 = [];

    tfidf.listTerms(0).forEach(item => {
      if (item.tfidf > 0.1) {
        importantTerms1.push(item.term);
      }
    });

    tfidf.listTerms(1).forEach(item => {
      if (item.tfidf > 0.1) {
        importantTerms2.push(item.term);
      }
    });

    // Find semantic differences
    const addedConcepts = importantTerms2.filter(term => !importantTerms1.includes(term));
    const removedConcepts = importantTerms1.filter(term => !importantTerms2.includes(term));
    const commonConcepts = importantTerms1.filter(term => importantTerms2.includes(term));

    return {
      addedConcepts,
      removedConcepts,
      commonConcepts,
      semanticSimilarity: similarity.compareTwoStrings(content1, content2),
      summary: {
        totalConcepts1: importantTerms1.length,
        totalConcepts2: importantTerms2.length,
        addedCount: addedConcepts.length,
        removedCount: removedConcepts.length,
        commonCount: commonConcepts.length
      }
    };
  }

  /**
   * Structural comparison
   */
  structuralComparison(content1, content2) {
    // Extract structural elements (sections, clauses, etc.)
    const structure1 = this.extractStructure(content1);
    const structure2 = this.extractStructure(content2);

    const addedSections = structure2.sections.filter(
      s2 => !structure1.sections.some(s1 => s1.title === s2.title)
    );

    const removedSections = structure1.sections.filter(
      s1 => !structure2.sections.some(s2 => s2.title === s1.title)
    );

    const modifiedSections = structure1.sections.filter(s1 => {
      const s2 = structure2.sections.find(s => s.title === s1.title);
      return s2 && s1.content !== s2.content;
    });

    return {
      structure1,
      structure2,
      changes: {
        addedSections,
        removedSections,
        modifiedSections
      },
      statistics: {
        sectionsAdded: addedSections.length,
        sectionsRemoved: removedSections.length,
        sectionsModified: modifiedSections.length
      }
    };
  }

  /**
   * Extract document structure
   */
  extractStructure(content) {
    const sections = [];
    const lines = content.split('\n');
    let currentSection = null;
    let currentContent = [];

    const sectionRegex = /^(\d+\.?\s*|[A-Z]+\.?\s*|Article\s+\d+|Section\s+\d+|Clause\s+\d+)/i;

    lines.forEach(line => {
      if (sectionRegex.test(line)) {
        if (currentSection) {
          sections.push({
            title: currentSection,
            content: currentContent.join('\n').trim(),
            wordCount: currentContent.join(' ').split(/\s+/).length
          });
        }
        currentSection = line;
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    });

    // Add last section
    if (currentSection) {
      sections.push({
        title: currentSection,
        content: currentContent.join('\n').trim(),
        wordCount: currentContent.join(' ').split(/\s+/).length
      });
    }

    return {
      sections,
      totalSections: sections.length,
      totalWords: sections.reduce((sum, s) => sum + s.wordCount, 0)
    };
  }

  /**
   * Compare metadata
   */
  compareMetadata(contract1, contract2) {
    const metadata = {
      differences: [],
      similarities: []
    };

    // Compare basic fields
    const fields = ['type', 'status', 'value'];
    
    fields.forEach(field => {
      if (contract1[field] !== contract2[field]) {
        metadata.differences.push({
          field,
          left: contract1[field],
          right: contract2[field]
        });
      } else if (contract1[field]) {
        metadata.similarities.push({
          field,
          value: contract1[field]
        });
      }
    });

    // Compare dates
    const dateFields = ['createdAt', 'updatedAt', 'signedAt'];
    
    dateFields.forEach(field => {
      if (contract1.dates?.[field] || contract2.dates?.[field]) {
        const date1 = contract1.dates?.[field];
        const date2 = contract2.dates?.[field];
        
        if (date1?.toString() !== date2?.toString()) {
          metadata.differences.push({
            field: `dates.${field}`,
            left: date1,
            right: date2
          });
        }
      }
    });

    // Compare parties
    const parties1 = contract1.parties.map(p => p.email).sort();
    const parties2 = contract2.parties.map(p => p.email).sort();
    
    if (parties1.join(',') !== parties2.join(',')) {
      metadata.differences.push({
        field: 'parties',
        left: parties1,
        right: parties2
      });
    }

    // Compare tags
    const tags1 = contract1.tags.sort();
    const tags2 = contract2.tags.sort();
    
    if (tags1.join(',') !== tags2.join(',')) {
      metadata.differences.push({
        field: 'tags',
        left: tags1,
        right: tags2
      });
    }

    return metadata;
  }

  /**
   * Calculate similarity score
   */
  calculateSimilarity(content1, content2) {
    // Multiple similarity metrics
    const stringSimilarity = similarity.compareTwoStrings(content1, content2);
    
    // Jaccard similarity
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    const jaccardSimilarity = intersection.size / union.size;

    // Length similarity
    const lengthSimilarity = Math.min(content1.length, content2.length) / 
                           Math.max(content1.length, content2.length);

    return {
      overall: (stringSimilarity + jaccardSimilarity + lengthSimilarity) / 3,
      string: stringSimilarity,
      jaccard: jaccardSimilarity,
      length: lengthSimilarity,
      percentage: Math.round(((stringSimilarity + jaccardSimilarity + lengthSimilarity) / 3) * 100)
    };
  }

  /**
   * Compare multiple contracts
   */
  async compareMultiple(contractIds, options = {}) {
    try {
      if (contractIds.length < 2) {
        throw new Error('At least 2 contracts required for comparison');
      }

      const contracts = await Contract.find({
        _id: { $in: contractIds }
      });

      if (contracts.length !== contractIds.length) {
        throw new Error('Some contracts not found');
      }

      // Create comparison matrix
      const comparisons = [];
      
      for (let i = 0; i < contracts.length - 1; i++) {
        for (let j = i + 1; j < contracts.length; j++) {
          const comparison = await this.compareContracts(
            contracts[i]._id,
            contracts[j]._id,
            options
          );
          
          comparisons.push({
            contract1: contracts[i]._id,
            contract2: contracts[j]._id,
            similarity: comparison.similarity.percentage
          });
        }
      }

      // Find most similar and most different pairs
      comparisons.sort((a, b) => b.similarity - a.similarity);

      return {
        contracts: contracts.map(c => ({
          id: c._id,
          title: c.title,
          version: c.currentVersion
        })),
        comparisons,
        mostSimilar: comparisons[0],
        mostDifferent: comparisons[comparisons.length - 1],
        averageSimilarity: comparisons.reduce((sum, c) => sum + c.similarity, 0) / comparisons.length
      };
    } catch (error) {
      logger.error('Compare multiple error:', error);
      throw error;
    }
  }

  /**
   * Generate comparison report
   */
  async generateComparisonReport(comparisonData, format = 'html') {
    try {
      // This would generate a formatted report
      // Implementation depends on your reporting requirements
      
      const report = {
        title: 'Contract Comparison Report',
        generatedAt: new Date(),
        comparison: comparisonData,
        format
      };

      return report;
    } catch (error) {
      logger.error('Generate comparison report error:', error);
      throw error;
    }
  }
}

module.exports = new ComparisonService();