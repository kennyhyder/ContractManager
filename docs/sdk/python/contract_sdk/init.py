"""
Contract Management System Python SDK

A Python client library for the Contract Management API.
"""

from .client import (
    ContractManagementClient,
    create_client,
    APIError,
    AuthenticationError,
    ValidationError,
    NetworkError,
    __version__
)

__all__ = [
    'ContractManagementClient',
    'create_client',
    'APIError',
    'AuthenticationError',
    'ValidationError',
    'NetworkError',
    '__version__'
]