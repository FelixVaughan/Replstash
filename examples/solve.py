class Solver:
    def is_palindrome(self, text):
        # Remove spaces and convert to lowercase
        cleaned = ''.join(char.lower() for char in text if char.isalnum())
        return cleaned == cleaned[::-1]
    
    def find_factors(self, n):
        if not isinstance(n, int):
            raise ValueError("Input must be an integer")
        if n <= 0:
            raise ValueError("Input must be positive")
            
        factors = []
        for i in range(1, n + 1):
            if n % i == 0:
                factors.append(i)
        return factors
    
    def are_anagrams(self, str1, str2):
        # Remove spaces and convert to lowercase
        s1 = ''.join(char.lower() for char in str1 if char.isalnum())
        s2 = ''.join(char.lower() for char in str2 if char.isalnum())
        
        if not s1 or not s2:
            return False
            
        # Create character frequency dictionaries
        freq1 = {}
        freq2 = {}
        
        for char in s1:
            freq1[char] = freq1.get(char, 0) + 1
        for char in s2:
            freq2[char] = freq2.get(char, 0) + 1
            
        return freq1 == freq2
    
    def get_permutations(self, items):
        if len(items) <= 1:
            return [items]
        
        perms = []
        for i in range(len(items)):
            current = items[i]
            remaining = items[:i] + items[i+1:]
            
            for p in self.get_permutations(remaining):
                perms.append([current] + p)
                
        return perms
