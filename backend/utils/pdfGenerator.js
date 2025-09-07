const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

/**
 * PDF Generator utility
 */
class PDFGenerator {
  constructor() {
    this.defaultOptions = {
      margin: 50,
      fontSize: 12,
      fontFamily: 'Helvetica'
    };

    this.colors = {
      primary: '#1a73e8',
      secondary: '#5f6368',
      text: '#202124',
      lightGray: '#f8f9fa',
      border: '#dadce0'
    };
  }

  /**
   * Generate contract PDF
   */
  async generateContractPDF(contract, options = {}) {
    const doc = new PDFDocument({
      size: 'A4',
      margin: this.defaultOptions.margin,
      info: {
        Title: contract.title,
        Author: 'Contract Management System',
        Subject: `Contract - ${contract.contractNumber}`,
        CreationDate: new Date()
      }
    });

    // Create buffer to store PDF
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    // Add header
    this.addHeader(doc, contract);

    // Add contract details
    this.addContractDetails(doc, contract);

    // Add parties section
    this.addPartiesSection(doc, contract.parties);

    // Add content
    this.addContent(doc, contract.content);

    // Add terms section
    if (contract.terms) {
      this.addTermsSection(doc, contract.terms);
    }

    // Add signatures section
    this.addSignatureSection(doc, contract.parties);

    // Add footer
    this.addFooter(doc, contract);

    // Finalize PDF
    doc.end();

    // Return buffer
    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);
    });
  }

  /**
   * Generate template PDF
   */
  async generateTemplatePDF(template, options = {}) {
    const doc = new PDFDocument({
      size: 'A4',
      margin: this.defaultOptions.margin
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    // Add template header
    this.addTemplateHeader(doc, template);

    // Add template info
    this.addTemplateInfo(doc, template);

    // Add variables section
    if (template.variables && template.variables.length > 0) {
      this.addVariablesSection(doc, template.variables);
    }

    // Add content preview
    this.addContent(doc, template.content, true);

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);
    });
  }

  /**
   * Generate report PDF
   */
  async generateReportPDF(reportData, options = {}) {
    const doc = new PDFDocument({
      size: 'A4',
      margin: this.defaultOptions.margin,
      layout: options.layout || 'portrait'
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    // Add report header
    this.addReportHeader(doc, reportData);

    // Add summary section
    if (reportData.summary) {
      this.addSummarySection(doc, reportData.summary);
    }

    // Add charts/graphs
    if (reportData.charts) {
      for (const chart of reportData.charts) {
        await this.addChart(doc, chart);
      }
    }

    // Add data tables
    if (reportData.tables) {
      for (const table of reportData.tables) {
        this.addTable(doc, table);
      }
    }

    // Add conclusions
    if (reportData.conclusions) {
      this.addConclusionsSection(doc, reportData.conclusions);
    }

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);
    });
  }

  /**
   * Helper methods
   */

  addHeader(doc, contract) {
    const startY = doc.y;

    // Logo placeholder
    doc.rect(50, 50, 60, 60)
       .stroke(this.colors.border);
    
    doc.fontSize(8)
       .fillColor(this.colors.secondary)
       .text('LOGO', 55, 75, { width: 50, align: 'center' });

    // Company info
    doc.fontSize(16)
       .fillColor(this.colors.primary)
       .text('Contract Management System', 130, 55);
    
    doc.fontSize(10)
       .fillColor(this.colors.secondary)
       .text('123 Business Street, Suite 100', 130, 75)
       .text('City, State 12345', 130, 88)
       .text('contact@company.com | (555) 123-4567', 130, 101);

    // Contract number
    doc.fontSize(10)
       .fillColor(this.colors.text)
       .text(`Contract #: ${contract.contractNumber || 'N/A'}`, 400, 55, { align: 'right' })
       .text(`Date: ${moment().format('MMMM DD, YYYY')}`, 400, 70, { align: 'right' });

    // Line separator
    doc.moveTo(50, 130)
       .lineTo(545, 130)
       .stroke(this.colors.primary);

    doc.moveDown(3);
  }

  addContractDetails(doc, contract) {
    // Title
    doc.fontSize(20)
       .fillColor(this.colors.text)
       .text(contract.title, { align: 'center' })
       .moveDown();

    // Contract info box
    const infoY = doc.y;
    doc.rect(50, infoY, 495, 80)
       .fill(this.colors.lightGray);

    doc.fillColor(this.colors.text);

    // Left column
    doc.fontSize(10)
       .text('Contract Type:', 60, infoY + 10, { continued: true })
       .font('Helvetica-Bold')
       .text(` ${contract.type}`)
       .font('Helvetica');

    doc.text('Status:', 60, infoY + 25, { continued: true })
       .font('Helvetica-Bold')
       .text(` ${contract.status.toUpperCase()}`)
       .font('Helvetica');

    doc.text('Effective Date:', 60, infoY + 40, { continued: true })
       .font('Helvetica-Bold')
       .text(` ${moment(contract.dates?.effective).format('MMMM DD, YYYY')}`)
       .font('Helvetica');

    doc.text('Expiry Date:', 60, infoY + 55, { continued: true })
       .font('Helvetica-Bold')
       .text(` ${contract.dates?.expiry ? moment(contract.dates.expiry).format('MMMM DD, YYYY') : 'N/A'}`)
       .font('Helvetica');

    // Right column
    if (contract.value) {
      doc.text('Contract Value:', 300, infoY + 10, { continued: true })
         .font('Helvetica-Bold')
         .text(` $${contract.value.toLocaleString()}`)
         .font('Helvetica');
    }

    doc.y = infoY + 90;
    doc.moveDown();
  }

  addPartiesSection(doc, parties) {
    doc.fontSize(14)
       .fillColor(this.colors.primary)
       .text('PARTIES', { underline: true })
       .moveDown(0.5);

    parties.forEach((party, index) => {
      doc.fontSize(10)
         .fillColor(this.colors.text)
         .font('Helvetica-Bold')
         .text(`${party.role.toUpperCase()} ${index + 1}:`, { continued: true })
         .font('Helvetica')
         .text(` ${party.name}`)
         .text(`Email: ${party.email}`)
         .text(`Address: ${party.address || 'N/A'}`)
         .moveDown(0.5);
    });

    doc.moveDown();
  }

  addContent(doc, content, isPreview = false) {
    doc.fontSize(14)
       .fillColor(this.colors.primary)
       .text('CONTRACT TERMS', { underline: true })
       .moveDown();

    // Process content
    const paragraphs = content.split('\n\n');
    
    doc.fontSize(10)
       .fillColor(this.colors.text);

    paragraphs.forEach(paragraph => {
      if (paragraph.trim()) {
        // Check if it's a heading
        if (paragraph.match(/^\d+\.|^[A-Z]+\.|^Section \d+/)) {
          doc.font('Helvetica-Bold')
             .text(paragraph)
             .font('Helvetica');
        } else {
          doc.text(paragraph, {
            align: 'justify',
            lineGap: 2
          });
        }
        doc.moveDown(0.5);
      }
    });

    if (isPreview) {
      // Highlight variables
      doc.fillColor('red')
         .fontSize(8)
         .text('Note: Variables are shown in {{brackets}}')
         .fillColor(this.colors.text);
    }
  }

  addSignatureSection(doc, parties) {
    // Check if we need a new page
    if (doc.y > 600) {
      doc.addPage();
    }

    doc.fontSize(14)
       .fillColor(this.colors.primary)
       .text('SIGNATURES', { underline: true })
       .moveDown();

    const signatories = parties.filter(p => p.role === 'signatory');
    const signatureY = doc.y;

    signatories.forEach((party, index) => {
      const xOffset = index % 2 === 0 ? 50 : 300;
      const yOffset = Math.floor(index / 2) * 120;

      // Signature line
      doc.moveTo(xOffset, signatureY + yOffset + 40)
         .lineTo(xOffset + 200, signatureY + yOffset + 40)
         .stroke();

      // Party info
      doc.fontSize(10)
         .fillColor(this.colors.text)
         .text(party.name, xOffset, signatureY + yOffset + 45)
         .fontSize(8)
         .fillColor(this.colors.secondary)
         .text(party.role, xOffset, signatureY + yOffset + 58)
         .text(`Date: ${party.signedAt ? moment(party.signedAt).format('MM/DD/YYYY') : '___________'}`, 
               xOffset, signatureY + yOffset + 70);

      // Add signature if exists
      if (party.signature) {
        // This would add the actual signature image
        doc.fontSize(12)
           .fillColor(this.colors.text)
           .text('[Signed]', xOffset + 70, signatureY + yOffset + 20);
      }
    });
  }

  addFooter(doc, contract) {
    const pageCount = doc.bufferedPageRange().count;
    
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      
      // Footer line
      doc.moveTo(50, 750)
         .lineTo(545, 750)
         .stroke(this.colors.border);

      // Footer text
      doc.fontSize(8)
         .fillColor(this.colors.secondary)
         .text(
           `Page ${i + 1} of ${pageCount}`,
           50,
           760,
           { align: 'center' }
         );

      // Contract ID
      doc.text(
        `Contract ID: ${contract._id}`,
        50,
        770,
        { align: 'center' }
      );
    }
  }

  addTable(doc, tableData) {
    const { headers, rows, title } = tableData;
    
    if (title) {
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text(title)
         .font('Helvetica')
         .moveDown(0.5);
    }

    const cellWidth = 495 / headers.length;
    const cellHeight = 25;
    let tableY = doc.y;

    // Draw headers
    doc.rect(50, tableY, 495, cellHeight)
       .fill(this.colors.primary);

    doc.fillColor('white')
       .fontSize(10)
       .font('Helvetica-Bold');

    headers.forEach((header, i) => {
      doc.text(
        header,
        50 + (i * cellWidth) + 5,
        tableY + 8,
        { width: cellWidth - 10, align: 'center' }
      );
    });

    doc.font('Helvetica')
       .fillColor(this.colors.text);

    // Draw rows
    rows.forEach((row, rowIndex) => {
      const y = tableY + cellHeight + (rowIndex * cellHeight);
      
      // Alternate row color
      if (rowIndex % 2 === 1) {
        doc.rect(50, y, 495, cellHeight)
           .fill(this.colors.lightGray);
      }

      // Draw cell borders
      doc.rect(50, y, 495, cellHeight)
         .stroke(this.colors.border);

      // Draw cell content
      row.forEach((cell, cellIndex) => {
        doc.fillColor(this.colors.text)
           .text(
             cell.toString(),
             50 + (cellIndex * cellWidth) + 5,
             y + 8,
             { width: cellWidth - 10, align: 'center' }
           );
      });
    });

    doc.y = tableY + cellHeight + (rows.length * cellHeight) + 20;
  }

  async addChart(doc, chartData) {
    // This would integrate with a charting library
    // For now, add a placeholder
    const chartHeight = 200;
    
    doc.rect(50, doc.y, 495, chartHeight)
       .stroke(this.colors.border);
    
    doc.fontSize(12)
       .fillColor(this.colors.secondary)
       .text(chartData.title || 'Chart', 50, doc.y + chartHeight/2 - 10, {
         width: 495,
         align: 'center'
       });

    doc.y += chartHeight + 20;
  }

  addTemplateHeader(doc, template) {
    doc.fontSize(24)
       .fillColor(this.colors.primary)
       .text('CONTRACT TEMPLATE', { align: 'center' })
       .moveDown()
       .fontSize(18)
       .fillColor(this.colors.text)
       .text(template.name, { align: 'center' })
       .moveDown(2);
  }

  addTemplateInfo(doc, template) {
    const infoBox = [
      { label: 'Category:', value: template.category },
      { label: 'Created By:', value: template.createdBy?.name || 'System' },
      { label: 'Created Date:', value: moment(template.createdAt).format('MMMM DD, YYYY') },
      { label: 'Usage Count:', value: template.usageCount || 0 },
      { label: 'Public:', value: template.isPublic ? 'Yes' : 'No' }
    ];

    infoBox.forEach(item => {
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(this.colors.text)
         .text(item.label, { continued: true })
         .font('Helvetica')
         .text(` ${item.value}`)
         .moveDown(0.5);
    });

    if (template.description) {
      doc.moveDown()
         .fontSize(10)
         .font('Helvetica-Bold')
         .text('Description:')
         .font('Helvetica')
         .text(template.description)
         .moveDown();
    }
  }

  addVariablesSection(doc, variables) {
    doc.fontSize(14)
       .fillColor(this.colors.primary)
       .text('TEMPLATE VARIABLES', { underline: true })
       .moveDown();

    const tableData = {
      headers: ['Variable', 'Label', 'Type', 'Required'],
      rows: variables.map(v => [
        `{{${v.name}}}`,
        v.label,
        v.type,
        v.required ? 'Yes' : 'No'
      ])
    };

    this.addTable(doc, tableData);
    doc.moveDown();
  }

  addReportHeader(doc, reportData) {
    doc.fontSize(24)
       .fillColor(this.colors.primary)
       .text(reportData.title, { align: 'center' })
       .moveDown()
       .fontSize(12)
       .fillColor(this.colors.secondary)
       .text(`Generated: ${moment().format('MMMM DD, YYYY HH:mm')}`, { align: 'center' })
       .moveDown(2);
  }

  addSummarySection(doc, summary) {
    doc.fontSize(16)
       .fillColor(this.colors.primary)
       .text('EXECUTIVE SUMMARY', { underline: true })
       .moveDown();

    doc.fontSize(10)
       .fillColor(this.colors.text)
       .text(summary, { align: 'justify' })
       .moveDown(2);
  }

  addConclusionsSection(doc, conclusions) {
    doc.fontSize(16)
       .fillColor(this.colors.primary)
       .text('CONCLUSIONS', { underline: true })
       .moveDown();

    doc.fontSize(10)
       .fillColor(this.colors.text);

    if (Array.isArray(conclusions)) {
      conclusions.forEach((conclusion, index) => {
        doc.text(`${index + 1}. ${conclusion}`)
           .moveDown(0.5);
      });
    } else {
      doc.text(conclusions, { align: 'justify' });
    }
  }
}

module.exports = new PDFGenerator();