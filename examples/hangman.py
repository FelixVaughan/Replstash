import random
import string


def get_random_word_from_wordlist():
    wordlist = []
    list_file = "hangman_wordlist.txt"
    with open(list_file, 'r') as file:
        wordlist = file.read().split('\n')
    word = random.choice(wordlist)
    return word

def get_some_letters(word):
    letters = []
    temp = '_'*len(word)
    for char in list(word):
        if char not in letters:
            letters.append(char)
    character = random.choice(letters)
    for num, char in enumerate(list(word)):
        if char == character:
            templist = list(temp)
            templist[num] = char
            temp = ''.join(templist)
    return temp

def draw_hangman(chances):
    if chances == 0:
        print("----------")
        print("   ( )-|  ")
        print("  - | -    ")
        print(r"   / \     ")
    elif chances == 1:
        print("----------")
        print("   ( )-   ")
        print("  - | -    ")
        print(r"   / \     ")
    elif chances == 2:
        print("----------")
        print("   ( )    ")
        print("  - | -    ")
        print(r"   / \     ")
    elif chances == 3:
        print("----------")
        print("   ( )    ")
        print("  - | -    ")
        print("   /       ")
    elif chances == 4:
        print("----------")
        print("   ( )    ")
        print("  - | -    ")
        print("           ")
    elif chances == 5:
        print("----------")
        print("   ( )    ")
        print("    |      ")
        print("           ")
    elif chances == 6:
        print("----------")
        print("   ( )    ")
        print("           ")
        print("           ")

def pick_random_character():
    return random.choice(string.ascii_letters)

def start_hangman_game():
    word = get_random_word_from_wordlist()
    guessed = get_some_letters(word)
    chances = 9
    found = False
    while 1:
        if chances == 0:
            print(f"Sorry !!! You Lost, the word was: {word}")
            break
        character = pick_random_character()
        print("Character picked")
        for num, char in enumerate(list(word)):
            if char == character:
                templist = list(guessed)
                templist[num] = char
                guessed = ''.join(templist)
                found = True
        if found:
            found = False
        else:
            chances -= 1
        if '_' not in guessed:
            print(f"\nYou Won !!! The word was: {word}")
            print(f"You got it in {7 - chances} chances")
            if chances > 7:
                print("You are a genius")
            break
        else:
            draw_hangman(chances)
        print()

print("===== Welcome to Hangman Game =====")
start_hangman_game()