class Conversions:
    def __init__(self):
        self.conversion_history = []
    
    def celsius_to_fahrenheit(self, celsius):
        if not isinstance(celsius, (int, float)):
            raise ValueError("Temperature must be a number")
        if celsius < -273.15:  # Absolute zero check
            raise ValueError("Temperature below absolute zero")
        fahrenheit = (celsius * 9/5) + 32
        self.conversion_history.append(f"{celsius}°C → {fahrenheit}°F")
        return fahrenheit
    
    def fahrenheit_to_celsius(self, fahrenheit):
        if not isinstance(fahrenheit, (int, float)):
            raise ValueError("Temperature must be a number")
        if fahrenheit < -459.67:  # Absolute zero check
            raise ValueError("Temperature below absolute zero")
        celsius = (fahrenheit - 32) * 5/9
        self.conversion_history.append(f"{fahrenheit}°F → {celsius}°C")
        return celsius
    
    def kg_to_lb(self, kg):
        if not isinstance(kg, (int, float)):
            raise ValueError("Weight must be a number")
        if kg < 0:
            raise ValueError("Weight cannot be negative")
        pounds = kg * 2.20462
        self.conversion_history.append(f"{kg}kg → {pounds}lb")
        return pounds
    
    def chain_convert(self, value, conversions):
        """Chain multiple conversions together"""
        result = value
        for conversion in conversions:
            result = conversion(result)
        return result
    
    def get_history(self):
        return self.conversion_history
