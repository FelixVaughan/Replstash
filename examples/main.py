from conv import Conversions
from solve import Solver
from data_processor import DataProcessor

def unit_conversions():
    print("\n=== Temperature and Weight Conversions ===")
    conv = Conversions()
    
    # Good breakpoint location to try different temperatures
    temp_c = 25.0
    temp_f = conv.celsius_to_fahrenheit(temp_c)
    print(f"Converted {temp_c}°C to {temp_f}°F")
    
    # Breakpoint here to experiment with chain conversions
    # Try: conv.chain_convert(100, [conv.kg_to_lb, lambda x: x/16])  # kg to lb to oz
    weight_kg = 68.0
    weight_lb = conv.kg_to_lb(weight_kg)
    print(f"Converted {weight_kg}kg to {weight_lb}lb")
    
    print("Conversion history:", conv.get_history())

def string_operations():
    print("\n=== String and Number Operations ===")
    solver = Solver()
    
    # Breakpoint here to try different strings for palindrome checking
    text = "A man a plan a canal Panama"
    is_pal = solver.is_palindrome(text)
    print(f"Is '{text}' a palindrome? {is_pal}")
    
    # Breakpoint here to try different word pairs for anagrams
    word1, word2 = "listen", "silent"
    is_anagram = solver.are_anagrams(word1, word2)
    print(f"Are '{word1}' and '{word2}' anagrams? {is_anagram}")
    
    # Breakpoint here to try different numbers for factorization
    number = 28
    factors = solver.find_factors(number)
    print(f"Factors of {number}: {factors}")
    
    # Breakpoint here to try different lists for permutations
    items = ['A', 'B', 'C']
    perms = solver.get_permutations(items)
    print(f"Permutations of {items}: {perms}")

def analyze_data():
    print("\n=== Data Processing ===")
    processor = DataProcessor()
    
    # Breakpoint here to try different number sequences
    data = [1, 3, 2, 4, 1, 5, 2, 6, 4]
    processor.add_numbers(data)
    
    # Good location to inspect running averages
    averages = processor.running_average()
    print(f"Running averages: {averages}")
    
    # Breakpoint here to try different threshold values
    threshold = 3.0
    peaks = processor.find_peaks(threshold)
    print(f"Peaks above {threshold}: {peaks}")

def main():
    print("Starting examples...")
    
    unit_conversions()
    string_operations()
    analyze_data()
    
    print("\nExamples completed!")

if __name__ == "__main__":
    main() 