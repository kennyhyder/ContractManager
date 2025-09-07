"""
Contract Management System Python SDK

A Python client library for interacting with the Contract Management API.
"""

import json
import time
from typing import Dict, List, Optional, Any, Callable, BinaryIO
from datetime import datetime
from urllib.parse import urljoin
import requests
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry


__version__ = "1.0.0"


class APIError(Exception):
    """Base exception for API errors"""
    
    def __init__(self, message: str, code: str = None, status_code: int = None, details: Any = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details


class AuthenticationError(APIError):
    """Raised when authentication fails"""
    pass


class ValidationError(APIError):
    """Raised when request validation fails"""
    pass


class NetworkError(APIError):
    """Raised when network issues occur"""
    pass


class ContractManagementClient:
    """
    Main client for interacting with the Contract Management API
    
    Args:
        base_url: Base URL of the API
        api_key: Optional API key for authentication
        access_token: Optional access token for authentication
        timeout: Request timeout in seconds
        max_retries: Maximum number of retry attempts
        verify_ssl: Whether to verify SSL certificates
    """
    
    def __init__(
        self,
        base_url: str,
        api_key: Optional[str] = None,
        access_token: Optional[str] = None,
        timeout: int = 30,
        max_retries: int = 3,
        verify_ssl: bool = True
    ):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.access_token = access_token
        self.refresh_token = None
        self.timeout = timeout
        self.verify_ssl = verify_ssl
        
        # Setup session with retry strategy
        self.session = requests.Session()
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # Set default headers
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': f'ContractManagementSDK-Python/{__version__}'
        })
        
        if self.api_key:
            self.session.headers['X-API-Key'] = self.api_key
            
    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        files: Optional[Dict] = None,
        stream: bool = False
    ) -> Any:
        """Make HTTP request to the API"""
        url = urljoin(self.base_url, endpoint)
        
        # Add authentication header
        headers = {}
        if self.access_token:
            headers['Authorization'] = f'Bearer {self.access_token}'
            
        # Prepare request data
        kwargs = {
            'timeout': self.timeout,
            'verify': self.verify_ssl,
            'headers': headers,
            'params': params,
            'stream': stream
        }
        
        if files:
            kwargs['files'] = files
        elif data is not None:
            kwargs['data'] = json.dumps(data)
            
        try:
            response = self.session.request(method, url, **kwargs)
            
            # Handle token refresh
            if response.status_code == 401 and self.refresh_token:
                self._refresh_access_token()
                headers['Authorization'] = f'Bearer {self.access_token}'
                kwargs['headers'] = headers
                response = self.session.request(method, url, **kwargs)
                
            response.raise_for_status()
            
            if stream:
                return response
                
            if response.content:
                return response.json()
            return None
            
        except requests.exceptions.HTTPError as e:
            self._handle_error(e.response)
        except requests.exceptions.ConnectionError as e:
            raise NetworkError(f"Connection error: {str(e)}")
        except requests.exceptions.Timeout as e:
            raise NetworkError(f"Request timeout: {str(e)}")
        except requests.exceptions.RequestException as e:
            raise APIError(f"Request failed: {str(e)}")
            
    def _handle_error(self, response: requests.Response):
        """Handle API error responses"""
        try:
            error_data = response.json()
            message = error_data.get('message', 'An error occurred')
            code = error_data.get('code', 'UNKNOWN_ERROR')
            details = error_data.get('details')
        except:
            message = f"HTTP {response.status_code}: {response.text}"
            code = f"HTTP_{response.status_code}"
            details = None
            
        if response.status_code == 401:
            raise AuthenticationError(message, code, response.status_code, details)
        elif response.status_code == 400:
            raise ValidationError(message, code, response.status_code, details)
        else:
            raise APIError(message, code, response.status_code, details)
            
    def _refresh_access_token(self):
        """Refresh the access token using refresh token"""
        if not self.refresh_token:
            raise AuthenticationError("No refresh token available")
            
        data = self._make_request('POST', '/auth/refresh', {
            'refreshToken': self.refresh_token
        })
        
        self.access_token = data['accessToken']
        self.refresh_token = data['refreshToken']
        
    # Authentication Methods
    
    def login(self, email: str, password: str, two_factor_code: Optional[str] = None) -> Dict:
        """
        Login to the system
        
        Args:
            email: User email
            password: User password
            two_factor_code: Optional 2FA code
            
        Returns:
            Dict containing user info and tokens
        """
        data = {
            'email': email,
            'password': password
        }
        
        if two_factor_code:
            data['twoFactorCode'] = two_factor_code
            
        response = self._make_request('POST', '/auth/login', data)
        
        self.access_token = response['accessToken']
        self.refresh_token = response['refreshToken']
        
        return response
        
    def logout(self):
        """Logout from the system"""
        try:
            self._make_request('POST', '/auth/logout')
        finally:
            self.access_token = None
            self.refresh_token = None
            
    def get_current_user(self) -> Dict:
        """Get current user information"""
        return self._make_request('GET', '/users/me')
        
    # Contract Methods
    
    def get_contracts(
        self,
        status: Optional[str] = None,
        type: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
        sort_by: str = 'createdAt',
        sort_order: str = 'desc'
    ) -> Dict:
        """
        Get list of contracts
        
        Args:
            status: Filter by contract status
            type: Filter by contract type
            search: Search query
            page: Page number
            limit: Items per page
            sort_by: Sort field
            sort_order: Sort order (asc/desc)
            
        Returns:
            Paginated list of contracts
        """
        params = {
            'page': page,
            'limit': limit,
            'sortBy': sort_by,
            'sortOrder': sort_order
        }
        
        if status:
            params['status'] = status
        if type:
            params['type'] = type
        if search:
            params['search'] = search
            
        return self._make_request('GET', '/contracts', params=params)
        
    def get_contract(self, contract_id: str) -> Dict:
        """Get contract by ID"""
        return self._make_request('GET', f'/contracts/{contract_id}')
        
    def create_contract(
        self,
        title: str,
        type: str,
        description: Optional[str] = None,
        value: Optional[float] = None,
        currency: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        content: Optional[str] = None,
        parties: Optional[List[Dict]] = None,
        metadata: Optional[Dict] = None,
        tags: Optional[List[str]] = None
    ) -> Dict:
        """
        Create a new contract
        
        Args:
            title: Contract title
            type: Contract type
            description: Contract description
            value: Contract value
            currency: Currency code
            start_date: Start date (ISO format)
            end_date: End date (ISO format)
            content: Contract content
            parties: List of parties
            metadata: Additional metadata
            tags: List of tags
            
        Returns:
            Created contract
        """
        data = {
            'title': title,
            'type': type
        }
        
        if description:
            data['description'] = description
        if value is not None:
            data['value'] = value
        if currency:
            data['currency'] = currency
        if start_date:
            data['startDate'] = start_date
        if end_date:
            data['endDate'] = end_date
        if content:
            data['content'] = content
        if parties:
            data['parties'] = parties
        if metadata:
            data['metadata'] = metadata
        if tags:
            data['tags'] = tags
            
        return self._make_request('POST', '/contracts', data)
        
    def update_contract(self, contract_id: str, **kwargs) -> Dict:
        """Update contract"""
        return self._make_request('PUT', f'/contracts/{contract_id}', kwargs)
        
    def delete_contract(self, contract_id: str):
        """Delete contract"""
        self._make_request('DELETE', f'/contracts/{contract_id}')
        
    def get_contract_versions(self, contract_id: str) -> List[Dict]:
        """Get contract version history"""
        return self._make_request('GET', f'/contracts/{contract_id}/versions')
        
    def compare_contract_versions(
        self,
        contract_id: str,
        version1: int,
        version2: int
    ) -> Dict:
        """Compare two contract versions"""
        return self._make_request('POST', f'/contracts/{contract_id}/compare', {
            'version1': version1,
            'version2': version2
        })
        
    # Contract Actions
    
    def submit_for_approval(
        self,
        contract_id: str,
        approvers: List[str],
        message: Optional[str] = None
    ) -> Dict:
        """Submit contract for approval"""
        data = {'approvers': approvers}
        if message:
            data['message'] = message
            
        return self._make_request('POST', f'/contracts/{contract_id}/submit-approval', data)
        
    def approve_contract(self, contract_id: str, comments: Optional[str] = None) -> Dict:
        """Approve contract"""
        data = {}
        if comments:
            data['comments'] = comments
            
        return self._make_request('POST', f'/contracts/{contract_id}/approve', data)
        
    def reject_contract(self, contract_id: str, reason: str) -> Dict:
        """Reject contract"""
        return self._make_request('POST', f'/contracts/{contract_id}/reject', {
            'reason': reason
        })
        
    def sign_contract(self, contract_id: str, signature_data: Dict) -> Dict:
        """Sign contract"""
        return self._make_request('POST', f'/contracts/{contract_id}/sign', signature_data)
        
    # Comment Methods
    
    def get_comments(self, contract_id: str) -> List[Dict]:
        """Get contract comments"""
        return self._make_request('GET', f'/contracts/{contract_id}/comments')
        
    def add_comment(
        self,
        contract_id: str,
        content: str,
        parent_id: Optional[str] = None,
        position: Optional[Dict] = None,
        mentions: Optional[List[str]] = None
    ) -> Dict:
        """Add comment to contract"""
        data = {'content': content}
        
        if parent_id:
            data['parentId'] = parent_id
        if position:
            data['position'] = position
        if mentions:
            data['mentions'] = mentions
            
        return self._make_request('POST', f'/contracts/{contract_id}/comments', data)
        
    def update_comment(
        self,
        contract_id: str,
        comment_id: str,
        content: str
    ) -> Dict:
        """Update comment"""
        return self._make_request('PUT', f'/contracts/{contract_id}/comments/{comment_id}', {
            'content': content
        })
        
    def delete_comment(self, contract_id: str, comment_id: str):
        """Delete comment"""
        self._make_request('DELETE', f'/contracts/{contract_id}/comments/{comment_id}')
        
    # Template Methods
    
    def get_templates(
        self,
        category: Optional[str] = None,
        is_public: Optional[bool] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 20
    ) -> Dict:
        """Get list of templates"""
        params = {
            'page': page,
            'limit': limit
        }
        
        if category:
            params['category'] = category
        if is_public is not None:
            params['isPublic'] = is_public
        if search:
            params['search'] = search
            
        return self._make_request('GET', '/templates', params=params)
        
    def get_template(self, template_id: str) -> Dict:
        """Get template by ID"""
        return self._make_request('GET', f'/templates/{template_id}')
        
    def create_template(
        self,
        name: str,
        category: str,
        content: str,
        description: Optional[str] = None,
        variables: Optional[List[Dict]] = None,
        tags: Optional[List[str]] = None,
        is_public: bool = False,
        price: Optional[float] = None
    ) -> Dict:
        """Create a new template"""
        data = {
            'name': name,
            'category': category,
            'content': content,
            'isPublic': is_public
        }
        
        if description:
            data['description'] = description
        if variables:
            data['variables'] = variables
        if tags:
            data['tags'] = tags
        if price is not None:
            data['price'] = price
            
        return self._make_request('POST', '/templates', data)
        
    def update_template(self, template_id: str, **kwargs) -> Dict:
        """Update template"""
        return self._make_request('PUT', f'/templates/{template_id}', kwargs)
        
    def delete_template(self, template_id: str):
        """Delete template"""
        self._make_request('DELETE', f'/templates/{template_id}')
        
    # File Operations
    
    def upload_attachment(
        self,
        contract_id: str,
        file_path: str,
        filename: Optional[str] = None,
        progress_callback: Optional[Callable[[int], None]] = None
    ) -> Dict:
        """
        Upload file attachment to contract
        
        Args:
            contract_id: Contract ID
            file_path: Path to file
            filename: Optional custom filename
            progress_callback: Optional callback for upload progress
            
        Returns:
            Uploaded attachment info
        """
        import os
        
        if not os.path.exists(file_path):
            raise ValueError(f"File not found: {file_path}")
            
        file_size = os.path.getsize(file_path)
        
        with open(file_path, 'rb') as f:
            if not filename:
                filename = os.path.basename(file_path)
                
            files = {'file': (filename, f)}
            
            # Note: Progress tracking requires custom implementation
            return self._make_request(
                'POST',
                f'/contracts/{contract_id}/attachments',
                files=files
            )
            
    def download_attachment(
        self,
        contract_id: str,
        attachment_id: str,
        output_path: Optional[str] = None
    ) -> str:
        """
        Download attachment
        
        Args:
            contract_id: Contract ID
            attachment_id: Attachment ID
            output_path: Optional output file path
            
        Returns:
            Path to downloaded file
        """
        response = self._make_request(
            'GET',
            f'/contracts/{contract_id}/attachments/{attachment_id}',
            stream=True
        )
        
        if not output_path:
            # Extract filename from headers
            import re
            content_disposition = response.headers.get('content-disposition', '')
            filename_match = re.search(r'filename="?([^"]+)"?', content_disposition)
            filename = filename_match.group(1) if filename_match else f'attachment_{attachment_id}'
            output_path = filename
            
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                
        return output_path
        
    def export_contract(
        self,
        contract_id: str,
        format: str = 'pdf',
        output_path: Optional[str] = None
    ) -> str:
        """Export contract to file"""
        response = self._make_request(
            'GET',
            f'/contracts/{contract_id}/export',
            params={'format': format},
            stream=True
        )
        
        if not output_path:
            output_path = f'contract_{contract_id}.{format}'
            
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                
        return output_path
        
    # Analytics Methods
    
    def get_dashboard_analytics(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict:
        """Get dashboard analytics"""
        params = {}
        
        if start_date:
            params['startDate'] = start_date.isoformat()
        if end_date:
            params['endDate'] = end_date.isoformat()
            
        return self._make_request('GET', '/analytics/dashboard', params=params)
        
    def get_contract_analytics(self, contract_id: str) -> Dict:
        """Get contract analytics"""
        return self._make_request('GET', f'/analytics/contracts/{contract_id}')
        
    # Utility Methods
    
    def search_contracts(self, query: str) -> List[Dict]:
        """Search contracts"""
        return self._make_request('GET', '/contracts/search', params={'q': query})
        
    def bulk_update_contracts(
        self,
        contract_ids: List[str],
        updates: Dict
    ) -> List[Dict]:
        """Bulk update contracts"""
        return self._make_request('POST', '/contracts/bulk-update', {
            'contractIds': contract_ids,
            'updates': updates
        })


# Convenience function
def create_client(base_url: str, **kwargs) -> ContractManagementClient:
    """Create a new client instance"""
    return ContractManagementClient(base_url, **kwargs)