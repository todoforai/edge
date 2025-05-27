import asyncio
import logging
from typing import Any, Callable, Dict, List, TypeVar, Generic, Optional, Union, Awaitable
import time

logger = logging.getLogger("todoforai-observable")

T = TypeVar('T')

class Observable(Generic[T]):
    """
    A generic observable value that can be watched for changes.
    Supports both synchronous and asynchronous callbacks.
    """

    def __init__(self, initial_value: T, name: str = "unnamed"):
        self._value = initial_value
        self._name = name
        self._sync_callbacks: List[Callable[[T], None]] = []
        self._async_callbacks: List[Callable[[T], Awaitable[None]]] = []
        self._last_notification_time = 0
        self._notification_task = None
        self._debounce_time = 0.05  # 50ms debounce time
        logger.debug(f"Created observable '{name}' with initial value: {initial_value}")

    @property
    def value(self) -> T:
        """Get the current value"""
        return self._value

    @value.setter
    def value(self, new_value: T) -> None:
        self.set_value(new_value)

    def set_value(self, new_value: T) -> None:
        """Synchronous setter that schedules notification"""
        if self._value == new_value:
            logger.warning(f"No change in value for observable '{self._name}'")
            return  # No change, no notifications

        self._value = new_value

        # Notify observers
        self._notify()

    def _notify(self) -> None:
        """Notify all observers about the current value"""
        logger.debug(f"Observable '{self._name}' changed, notifying observers")

        # Cancel any pending debounced notifications
        if self._notification_task and not self._notification_task.done():
            self._notification_task.cancel()
            self._notification_task = None

        # Call synchronous callbacks
        for callback in self._sync_callbacks:
            try:
                callback(self._value)
            except Exception as e:
                logger.error(f"Error in sync callback for observable '{self._name}': {str(e)}")
        # Schedule async callbacks
        for callback in self._async_callbacks:
            try:
                asyncio.create_task(callback(self._value))
            except Exception as e:
                logger.error(f"Error scheduling async callback for observable '{self._name}': {str(e)}")

    def _debounced_notify(self) -> None:
        """Schedule a debounced notification"""
        current_time = time.time()

        # If we've notified recently, cancel any pending task and schedule a new one
        if current_time - self._last_notification_time < self._debounce_time:
            if self._notification_task and not self._notification_task.done():
                self._notification_task.cancel()

            # Schedule a new notification
            async def delayed_notify():
                await asyncio.sleep(self._debounce_time)
                self._notify()
                self._last_notification_time = time.time()

            self._notification_task = asyncio.create_task(delayed_notify())
        else:
            # It's been a while since the last notification, notify immediately
            self._notify()
            self._last_notification_time = current_time

    def subscribe(self, callback: Callable[[T], None]) -> Callable[[], None]:
        """
        Subscribe to changes with a synchronous callback.
        Returns an unsubscribe function.
        """
        self._sync_callbacks.append(callback)

        # Call immediately with current value
        try:
            callback(self._value)
        except Exception as e:
            logger.error(f"Error in initial sync callback for observable '{self._name}': {str(e)}")

        # Return unsubscribe function
        def unsubscribe():
            if callback in self._sync_callbacks:
                self._sync_callbacks.remove(callback)

        return unsubscribe

    def subscribe_async(self, callback: Callable[[T], Awaitable[None]], name: Optional[str] = None) -> Callable[[], None]:
        """
        Subscribe to changes with an asynchronous callback.
        Returns an unsubscribe function.
        
        Args:
            callback: The async callback function
            name: Optional name for the callback. If provided, will replace any existing callback with the same name.
        """
        # If name is provided, remove any existing callback with the same name
        if name:
            self._async_callbacks = [cb for cb in self._async_callbacks if getattr(cb, '_callback_name', None) != name]
            
            # Create a wrapper function that we can set attributes on
            async def named_callback_wrapper(value):
                return await callback(value)
            
            # Set the name on the wrapper
            named_callback_wrapper._callback_name = name
            actual_callback = named_callback_wrapper
        else:
            actual_callback = callback
        
        self._async_callbacks.append(actual_callback)

        # Call immediately with current value
        try:
            asyncio.create_task(actual_callback(self._value))
        except Exception as e:
            logger.error(f"Error in initial async callback for observable '{self._name}': {str(e)}")

        # Return unsubscribe function
        def unsubscribe():
            if actual_callback in self._async_callbacks:
                self._async_callbacks.remove(actual_callback)

        return unsubscribe

    def update(self, update_fn: Callable[[T], T]) -> None:
        """Update the value using a function that receives the current value"""
        new_value = update_fn(self._value)
        self.set_value(new_value)


class ObservableDictionary(Observable[Dict]):
    """
    An observable dictionary with special handling for dictionary operations.
    Provides a more natural dictionary-like interface while maintaining observability.
    """

    def __init__(self, initial_value: Dict = None, name: str = "unnamed"):
        super().__init__(initial_value or {}, name)

    def __getitem__(self, key):
        """Get an item from the dictionary"""
        return self._value[key]

    def __setitem__(self, key, value):
        """Set an item in the dictionary and notify observers"""
        if key in self._value and self._value[key] == value:
            return  # No change

        # Create a new dictionary to ensure proper change detection
        new_dict = dict(self._value)
        new_dict[key] = value
        self.value = new_dict # assigning self.value will trigger a notification instead of assigning to self._value

    def __delitem__(self, key):
        """Delete an item from the dictionary and notify observers with debouncing"""
        if key not in self._value:
            return  # Key doesn't exist

        # Since we're using debounced notifications, we can modify the dictionary in place
        # This avoids an unnecessary copy when we're just going to debounce anyway
        value_dict = self._value if isinstance(self._value, dict) else dict(self._value)
        del value_dict[key]
        self._value = value_dict

        # Use debounced notification
        self._debounced_notify()

    def __contains__(self, key):
        """Check if key exists in the dictionary"""
        return key in self._value

    def __len__(self):
        """Get the length of the dictionary"""
        return len(self._value)

    def __iter__(self):
        """Iterate over the dictionary keys"""
        return iter(self._value)

    def keys(self):
        """Get dictionary keys"""
        return self._value.keys()

    def values(self):
        """Get dictionary values"""
        return self._value.values()

    def items(self):
        """Get dictionary items"""
        return self._value.items()

    def get(self, key, default=None):
        """Get an item with a default value"""
        return self._value.get(key, default)

    def pop(self, key, default=None):
        """Remove and return an item from the dictionary"""
        if key not in self._value and default is not None:
            return default

        # Create a new dictionary without the key
        new_dict = dict(self._value)
        value = new_dict.pop(key, default)
        self.value = new_dict
        return value

    def clear(self):
        """Clear the dictionary"""
        if not self._value:
            return  # Already empty
        self.value = {}

    def update(self, other=None, **kwargs):
        """Update the dictionary with another dictionary"""
        if not other and not kwargs:
            return  # Nothing to update

        new_dict = dict(self._value)
        if other:
            if hasattr(other, 'items'):
                # Dictionary-like object
                new_dict.update(other)
            else:
                # Iterable of key-value pairs
                new_dict.update(other)
        if kwargs:
            new_dict.update(kwargs)

        self.value = new_dict


class ObservableRegistry:
    """
    Registry to manage multiple observables.
    Useful for creating a central place to access all observables.
    """

    def __init__(self):
        self._observables: Dict[str, Observable] = {}

    def create(self, name: str, initial_value: Any) -> Observable:
        """Create and register a new observable"""
        if name in self._observables:
            logger.warning(f"Observable '{name}' already exists, returning existing instance")
            return self._observables[name]

        # Create appropriate observable type based on initial value
        if isinstance(initial_value, dict):
            observable = ObservableDictionary(initial_value, name)
        else:
            observable = Observable(initial_value, name)

        self._observables[name] = observable
        return observable

    def get(self, name: str) -> Optional[Observable]:
        """Get an observable by name"""
        return self._observables.get(name)

    def remove(self, name: str) -> None:
        """Remove an observable from the registry"""
        if name in self._observables:
            del self._observables[name]


# Create a global registry
registry = ObservableRegistry()