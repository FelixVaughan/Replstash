
import random

choices = ["rock", "paper", "scissors"]
computer_1_score = 0
computer_2_score = 0
num_rounds = 5

while num_rounds > 0:
    computer_1_choice = random.choice(choices)
    computer_2_choice = random.choice(choices)


    if computer_1_choice == computer_2_choice:
        print("It's a tie!")
    elif computer_1_choice == "rock":
        if computer_2_choice == "scissors":
            computer_1_score += 1
        else:
            computer_2_score += 1
    elif computer_1_choice == "paper":
        if computer_2_choice == "rock":
            computer_1_score += 1
        else:
            computer_2_score += 1
    elif computer_1_choice == "scissors":
        if computer_2_choice == "paper":
            computer_1_score += 1
        else:
            computer_2_score += 1
            
    print(f"Computer 1: {computer_1_score}, Computer 2: {computer_2_score}")
    num_rounds -= 1
    
    
# Display final results
print("\nFinal Scores:")
print(f"Computer 1: {computer_1_score}")
print(f"Computer 2: {computer_2_score}")

if computer_1_score > computer_2_score:
    print("Computer 1 wins the game!")
elif computer_1_score < computer_2_score:
    print("Computer 2 wins the game!")
else:
    print("The game is a tie!")
    
    