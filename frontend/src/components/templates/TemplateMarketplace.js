import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import Loading from '../common/Loading';
import './TemplateMarketplace.css';

function TemplateMarketplace() {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    sortBy: 'popular',
    priceRange: 'all',
  });
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  useEffect(() => {
    loadMarketplaceTemplates();
  }, [filters]);

  const loadMarketplaceTemplates = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams(filters);
      const response = await fetch(`/api/marketplace/templates?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to load marketplace templates');
      
      const data = await response.json();
      setTemplates(data.templates);
    } catch (error) {
      console.error('Failed to load marketplace templates:', error);
      toast.error('Failed to load marketplace templates');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseTemplate = async (template) => {
    setSelectedTemplate(template);
    setShowPurchaseModal(true);
  };

  const confirmPurchase = async () => {
    try {
      const response = await fetch(`/api/marketplace/templates/${selectedTemplate._id}/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to purchase template');

      const data = await response.json();
      toast.success('Template purchased successfully!');
      setShowPurchaseModal(false);
      navigate(`/templates/${data.templateId}`);
    } catch (error) {
      toast.error('Failed to purchase template');
    }
  };

  const handleRateTemplate = async (templateId, rating) => {
    try {
      const response = await fetch(`/api/marketplace/templates/${templateId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ rating }),
      });

      if (!response.ok) throw new Error('Failed to rate template');

      toast.success('Thank you for your rating!');
      loadMarketplaceTemplates();
    } catch (error) {
      toast.error('Failed to rate template');
    }
  };

  const categories = [
    'All Categories',
    'Non-Disclosure Agreement',
    'Service Agreement',
    'Purchase Agreement',
    'Employment Contract',
    'Lease Agreement',
    'Partnership Agreement',
    'Other',
  ];

  if (loading && templates.length === 0) {
    return <Loading fullscreen />;
  }

  return (
    <div className="marketplace-container">
      <div className="marketplace-header">
        <div className="header-content">
          <h1>Template Marketplace</h1>
          <p>Discover professional contract templates created by the community</p>
        </div>
        
        <div className="header-stats">
          <div className="stat">
            <span className="stat-value">{templates.length}</span>
            <span className="stat-label">Templates</span>
          </div>
          <div className="stat">
            <span className="stat-value">500+</span>
            <span className="stat-label">Downloads</span>
          </div>
          <div className="stat">
            <span className="stat-value">4.5</span>
            <span className="stat-label">Avg Rating</span>
          </div>
        </div>
      </div>

      <div className="marketplace-filters">
        <input
          type="search"
          placeholder="Search templates..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="search-input"
        />

        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          className="filter-select"
        >
          {categories.map((category) => (
            <option key={category} value={category === 'All Categories' ? '' : category}>
              {category}
            </option>
          ))}
        </select>

        <select
          value={filters.sortBy}
          onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
          className="filter-select"
        >
          <option value="popular">Most Popular</option>
          <option value="recent">Recently Added</option>
          <option value="rating">Highest Rated</option>
          <option value="price-low">Price: Low to High</option>
          <option value="price-high">Price: High to Low</option>
        </select>

        <select
          value={filters.priceRange}
          onChange={(e) => setFilters({ ...filters, priceRange: e.target.value })}
          className="filter-select"
        >
          <option value="all">All Prices</option>
          <option value="free">Free</option>
          <option value="0-10">$0 - $10</option>
          <option value="10-50">$10 - $50</option>
          <option value="50+">$50+</option>
        </select>
      </div>

      <div className="templates-grid">
        {templates.map((template) => (
          <div key={template._id} className="marketplace-template-card">
            <div className="template-header">
              <div className="template-icon">
                {template.category === 'Non-Disclosure Agreement' && '🤐'}
                {template.category === 'Service Agreement' && '🤝'}
                {template.category === 'Purchase Agreement' && '🛒'}
                {template.category === 'Employment Contract' && '💼'}
                {template.category === 'Lease Agreement' && '🏠'}
                {template.category === 'Partnership Agreement' && '👥'}
                {!['Non-Disclosure Agreement', 'Service Agreement', 'Purchase Agreement', 'Employment Contract', 'Lease Agreement', 'Partnership Agreement'].includes(template.category) && '📄'}
              </div>
              <div className="template-price">
                {template.price === 0 ? (
                  <span className="free-badge">FREE</span>
                ) : (
                  <span className="price">${template.price}</span>
                )}
              </div>
            </div>

            <div className="template-body">
              <h3>{template.name}</h3>
              <p className="template-description">{template.description}</p>
              
              <div className="template-author">
                <img
                  src={template.author.avatar || '/default-avatar.png'}
                  alt={template.author.name}
                  className="author-avatar"
                />
                <span className="author-name">{template.author.name}</span>
              </div>

              <div className="template-stats">
                <div className="stat">
                  <span className="stat-icon">⭐</span>
                  <span>{template.rating?.toFixed(1) || 'N/A'}</span>
                </div>
                <div className="stat">
                  <span className="stat-icon">⬇️</span>
                  <span>{template.downloads || 0}</span>
                </div>
                <div className="stat">
                  <span className="stat-icon">💬</span>
                  <span>{template.reviews?.length || 0}</span>
                </div>
              </div>

              {template.tags && template.tags.length > 0 && (
                <div className="template-tags">
                  {template.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                  {template.tags.length > 3 && (
                    <span className="tag">+{template.tags.length - 3}</span>
                  )}
                </div>
              )}
            </div>

            <div className="template-footer">
              <button
                onClick={() => navigate(`/marketplace/templates/${template._id}`)}
                className="btn btn-secondary btn-sm"
              >
                Preview
              </button>
              
              {template.isPurchased ? (
                <button
                  onClick={() => navigate(`/contracts/new?template=${template._id}`)}
                  className="btn btn-primary btn-sm"
                >
                  Use Template
                </button>
              ) : (
                <button
                  onClick={() => handlePurchaseTemplate(template)}
                  className="btn btn-primary btn-sm"
                >
                  {template.price === 0 ? 'Get Free' : `Buy $${template.price}`}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {templates.length === 0 && !loading && (
        <div className="empty-state">
          <p>No templates found matching your criteria</p>
          <button
            onClick={() => setFilters({
              search: '',
              category: '',
              sortBy: 'popular',
              priceRange: 'all',
            })}
            className="btn btn-primary"
          >
            Clear Filters
          </button>
        </div>
      )}

      {showPurchaseModal && selectedTemplate && (
        <div className="modal-overlay" onClick={() => setShowPurchaseModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Purchase Template</h2>
            
            <div className="purchase-details">
              <h3>{selectedTemplate.name}</h3>
              <p>{selectedTemplate.description}</p>
              
              <div className="purchase-info">
                <div className="info-row">
                  <span>Author:</span>
                  <span>{selectedTemplate.author.name}</span>
                </div>
                <div className="info-row">
                  <span>Category:</span>
                  <span>{selectedTemplate.category}</span>
                </div>
                <div className="info-row">
                  <span>Downloads:</span>
                  <span>{selectedTemplate.downloads || 0}</span>
                </div>
                <div className="info-row">
                  <span>Rating:</span>
                  <span>⭐ {selectedTemplate.rating?.toFixed(1) || 'N/A'}</span>
                </div>
              </div>

              <div className="price-section">
                <span className="price-label">Total:</span>
                <span className="price-value">
                  {selectedTemplate.price === 0 ? 'FREE' : `$${selectedTemplate.price}`}
                </span>
              </div>
            </div>

            <div className="modal-actions">
              <button
                onClick={() => setShowPurchaseModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmPurchase}
                className="btn btn-primary"
              >
                {selectedTemplate.price === 0 ? 'Get Template' : 'Complete Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TemplateMarketplace;