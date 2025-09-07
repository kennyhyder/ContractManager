const Template = require('../models/Template');
const User = require('../models/User');
const logger = require('../utils/logger');

const templateData = [
  {
    name: 'Non-Disclosure Agreement',
    category: 'legal',
    description: 'Standard NDA template for protecting confidential information',
    content: `<h1>NON-DISCLOSURE AGREEMENT</h1>
<p>This Non-Disclosure Agreement ("Agreement") is entered into as of {{date}} between {{party1_name}} ("Disclosing Party") and {{party2_name}} ("Receiving Party").</p>

<h2>1. CONFIDENTIAL INFORMATION</h2>
<p>For purposes of this Agreement, "Confidential Information" means all information disclosed by the Disclosing Party to the Receiving Party, whether orally, in writing, or in any other form, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information.</p>

<h2>2. OBLIGATIONS</h2>
<p>The Receiving Party agrees to:</p>
<ul>
<li>Hold the Confidential Information in strict confidence</li>
<li>Not disclose the Confidential Information to any third parties</li>
<li>Use the Confidential Information solely for the purpose of {{purpose}}</li>
<li>Protect the Confidential Information with the same degree of care as it uses for its own confidential information</li>
</ul>

<h2>3. TERM</h2>
<p>This Agreement shall remain in effect for {{term_years}} years from the date first written above.</p>

<h2>4. SIGNATURES</h2>
<p>IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.</p>

<div class="signature-block">
<p>DISCLOSING PARTY:</p>
<p>Signature: _________________________</p>
<p>Name: {{party1_name}}</p>
<p>Date: {{party1_date}}</p>
</div>

<div class="signature-block">
<p>RECEIVING PARTY:</p>
<p>Signature: _________________________</p>
<p>Name: {{party2_name}}</p>
<p>Date: {{party2_date}}</p>
</div>`,
    variables: [
      { name: 'date', type: 'date', label: 'Agreement Date', required: true },
      { name: 'party1_name', type: 'text', label: 'Disclosing Party Name', required: true },
      { name: 'party2_name', type: 'text', label: 'Receiving Party Name', required: true },
      { name: 'purpose', type: 'text', label: 'Purpose', required: true },
      { name: 'term_years', type: 'number', label: 'Term (Years)', required: true, defaultValue: 3 }
    ],
    tags: ['nda', 'confidentiality', 'legal'],
    isPublic: true,
    isActive: true
  },
  {
    name: 'Service Agreement',
    category: 'business',
    description: 'Professional services agreement template',
    content: `<h1>SERVICE AGREEMENT</h1>
<p>This Service Agreement ("Agreement") is made as of {{date}} between {{client_name}} ("Client") and {{provider_name}} ("Service Provider").</p>

<h2>1. SERVICES</h2>
<p>The Service Provider agrees to provide the following services:</p>
<p>{{services_description}}</p>

<h2>2. COMPENSATION</h2>
<p>The Client agrees to pay the Service Provider:</p>
<ul>
<li>Amount: ${{amount}}</li>
<li>Payment Terms: {{payment_terms}}</li>
</ul>

<h2>3. TERM</h2>
<p>This Agreement shall commence on {{start_date}} and continue until {{end_date}}, unless terminated earlier in accordance with this Agreement.</p>

<h2>4. DELIVERABLES</h2>
<p>The Service Provider shall deliver the following:</p>
<p>{{deliverables}}</p>

<h2>5. INTELLECTUAL PROPERTY</h2>
<p>{{ip_terms}}</p>

<h2>6. CONFIDENTIALITY</h2>
<p>Both parties agree to maintain the confidentiality of any proprietary information received during the term of this Agreement.</p>

<h2>7. TERMINATION</h2>
<p>Either party may terminate this Agreement with {{notice_days}} days written notice.</p>

<h2>8. SIGNATURES</h2>
<div class="signature-block">
<p>CLIENT:</p>
<p>Signature: _________________________</p>
<p>Name: {{client_name}}</p>
<p>Date: {{client_date}}</p>
</div>

<div class="signature-block">
<p>SERVICE PROVIDER:</p>
<p>Signature: _________________________</p>
<p>Name: {{provider_name}}</p>
<p>Date: {{provider_date}}</p>
</div>`,
    variables: [
      { name: 'date', type: 'date', label: 'Agreement Date', required: true },
      { name: 'client_name', type: 'text', label: 'Client Name', required: true },
      { name: 'provider_name', type: 'text', label: 'Service Provider Name', required: true },
      { name: 'services_description', type: 'textarea', label: 'Services Description', required: true },
      { name: 'amount', type: 'number', label: 'Amount', required: true },
      { name: 'payment_terms', type: 'text', label: 'Payment Terms', required: true },
      { name: 'start_date', type: 'date', label: 'Start Date', required: true },
      { name: 'end_date', type: 'date', label: 'End Date', required: true },
      { name: 'deliverables', type: 'textarea', label: 'Deliverables', required: true },
      { name: 'ip_terms', type: 'textarea', label: 'IP Terms', required: true },
      { name: 'notice_days', type: 'number', label: 'Notice Period (Days)', required: true, defaultValue: 30 }
    ],
    tags: ['service', 'business', 'professional'],
    isPublic: true,
    isActive: true
  },
  {
    name: 'Employment Contract',
    category: 'hr',
    description: 'Standard employment contract template',
    content: `<h1>EMPLOYMENT CONTRACT</h1>
<p>This Employment Contract ("Contract") is entered into as of {{date}} between {{company_name}} ("Employer") and {{employee_name}} ("Employee").</p>

<h2>1. POSITION</h2>
<p>The Employer hereby employs the Employee as {{position_title}}. The Employee accepts such employment and agrees to perform the duties and responsibilities inherent in such position.</p>

<h2>2. COMPENSATION</h2>
<ul>
<li>Base Salary: ${{annual_salary}} per year</li>
<li>Payment Frequency: {{payment_frequency}}</li>
<li>Benefits: {{benefits_description}}</li>
</ul>

<h2>3. EMPLOYMENT TERM</h2>
<p>Employment Start Date: {{start_date}}</p>
<p>Employment Type: {{employment_type}}</p>

<h2>4. WORK SCHEDULE</h2>
<p>{{work_schedule}}</p>

<h2>5. VACATION AND LEAVE</h2>
<p>{{leave_policy}}</p>

<h2>6. CONFIDENTIALITY</h2>
<p>The Employee agrees to maintain strict confidentiality regarding all proprietary information of the Employer.</p>

<h2>7. TERMINATION</h2>
<p>{{termination_terms}}</p>

<h2>8. SIGNATURES</h2>
<div class="signature-block">
<p>EMPLOYER:</p>
<p>Signature: _________________________</p>
<p>Name: {{employer_signatory}}</p>
<p>Title: {{employer_title}}</p>
<p>Date: {{employer_date}}</p>
</div>

<div class="signature-block">
<p>EMPLOYEE:</p>
<p>Signature: _________________________</p>
<p>Name: {{employee_name}}</p>
<p>Date: {{employee_date}}</p>
</div>`,
    variables: [
      { name: 'date', type: 'date', label: 'Contract Date', required: true },
      { name: 'company_name', type: 'text', label: 'Company Name', required: true },
      { name: 'employee_name', type: 'text', label: 'Employee Name', required: true },
      { name: 'position_title', type: 'text', label: 'Position Title', required: true },
      { name: 'annual_salary', type: 'number', label: 'Annual Salary', required: true },
      { name: 'payment_frequency', type: 'select', label: 'Payment Frequency', required: true, options: ['Monthly', 'Bi-weekly', 'Weekly'] },
      { name: 'benefits_description', type: 'textarea', label: 'Benefits Description', required: true },
      { name: 'start_date', type: 'date', label: 'Start Date', required: true },
      { name: 'employment_type', type: 'select', label: 'Employment Type', required: true, options: ['Full-time', 'Part-time', 'Contract'] },
      { name: 'work_schedule', type: 'textarea', label: 'Work Schedule', required: true },
      { name: 'leave_policy', type: 'textarea', label: 'Leave Policy', required: true },
      { name: 'termination_terms', type: 'textarea', label: 'Termination Terms', required: true }
    ],
    tags: ['employment', 'hr', 'hiring'],
    isPublic: true,
    isActive: true
  },
  {
    name: 'Sales Agreement',
    category: 'sales',
    description: 'Product/service sales agreement template',
    content: `<h1>SALES AGREEMENT</h1>
<p>This Sales Agreement ("Agreement") is made as of {{date}} between {{seller_name}} ("Seller") and {{buyer_name}} ("Buyer").</p>

<h2>1. PRODUCTS/SERVICES</h2>
<p>The Seller agrees to sell and the Buyer agrees to purchase:</p>
<p>{{products_description}}</p>

<h2>2. PRICE AND PAYMENT</h2>
<ul>
<li>Total Price: ${{total_price}}</li>
<li>Payment Method: {{payment_method}}</li>
<li>Payment Terms: {{payment_terms}}</li>
</ul>

<h2>3. DELIVERY</h2>
<p>Delivery Date: {{delivery_date}}</p>
<p>Delivery Location: {{delivery_location}}</p>
<p>Delivery Terms: {{delivery_terms}}</p>

<h2>4. WARRANTIES</h2>
<p>{{warranty_terms}}</p>

<h2>5. LIMITATION OF LIABILITY</h2>
<p>{{liability_terms}}</p>

<h2>6. GOVERNING LAW</h2>
<p>This Agreement shall be governed by the laws of {{governing_state}}.</p>

<h2>7. SIGNATURES</h2>
<div class="signature-block">
<p>SELLER:</p>
<p>Signature: _________________________</p>
<p>Name: {{seller_name}}</p>
<p>Date: {{seller_date}}</p>
</div>

<div class="signature-block">
<p>BUYER:</p>
<p>Signature: _________________________</p>
<p>Name: {{buyer_name}}</p>
<p>Date: {{buyer_date}}</p>
</div>`,
    variables: [
      { name: 'date', type: 'date', label: 'Agreement Date', required: true },
      { name: 'seller_name', type: 'text', label: 'Seller Name', required: true },
      { name: 'buyer_name', type: 'text', label: 'Buyer Name', required: true },
      { name: 'products_description', type: 'textarea', label: 'Products/Services Description', required: true },
      { name: 'total_price', type: 'number', label: 'Total Price', required: true },
      { name: 'payment_method', type: 'text', label: 'Payment Method', required: true },
      { name: 'payment_terms', type: 'text', label: 'Payment Terms', required: true },
      { name: 'delivery_date', type: 'date', label: 'Delivery Date', required: true },
      { name: 'delivery_location', type: 'text', label: 'Delivery Location', required: true },
      { name: 'delivery_terms', type: 'textarea', label: 'Delivery Terms', required: true },
      { name: 'warranty_terms', type: 'textarea', label: 'Warranty Terms', required: true },
      { name: 'liability_terms', type: 'textarea', label: 'Liability Terms', required: true },
      { name: 'governing_state', type: 'text', label: 'Governing State', required: true }
    ],
    tags: ['sales', 'purchase', 'commercial'],
    isPublic: true,
    isActive: true
  }
];

module.exports = {
  async seed() {
    try {
      // Check if templates already exist
      const existingTemplates = await Template.countDocuments();
      if (existingTemplates > 0) {
        logger.info('Templates already exist, skipping seed');
        return { skipped: true, reason: 'Templates already exist' };
      }

      // Get admin user as owner
      const adminUser = await User.findOne({ role: 'admin' });
      if (!adminUser) {
        throw new Error('Admin user not found. Please seed users first.');
      }

      // Add owner to all templates
      const templates = templateData.map(template => ({
        ...template,
        owner: adminUser._id,
        createdBy: adminUser._id
      }));

      // Create templates
      const createdTemplates = await Template.insertMany(templates);

      return {
        created: createdTemplates.length,
        templates: createdTemplates.map(t => ({
          id: t._id,
          name: t.name,
          category: t.category
        }))
      };
    } catch (error) {
      logger.error('Error seeding templates:', error);
      throw error;
    }
  },

  async clean() {
    try {
      const result = await Template.deleteMany({
        name: { $in: templateData.map(t => t.name) }
      });

      return {
        deleted: result.deletedCount
      };
    } catch (error) {
      logger.error('Error cleaning templates:', error);
      throw error;
    }
  }
};