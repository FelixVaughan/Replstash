class DataProcessor:
    def __init__(self):
        self.data = []
        
    def add_numbers(self, numbers):
        """Add a list of numbers with validation"""
        for num in numbers:
            if not isinstance(num, (int, float)):
                raise ValueError(f"Invalid number: {num}")
            self.data.append(num)
    
    def running_average(self):
        """Calculate running averages of the data"""
        if not self.data:
            return []
            
        result = []
        total = 0
        
        for i, num in enumerate(self.data, 1):
            total += num
            result.append(total / i)
            
        return result
    
    def find_peaks(self, threshold=None):
        """Find local peaks in the data"""
        if len(self.data) < 3:
            return []
            
        peaks = []
        for i in range(1, len(self.data) - 1):
            if self.data[i] > self.data[i-1] and self.data[i] > self.data[i+1]:
                if threshold is None or self.data[i] > threshold:
                    peaks.append((i, self.data[i]))
                    
        return peaks 