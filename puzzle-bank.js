/**
 * Pool of MCQ puzzles for door locks (logic, patterns, light IQ-style).
 * Each: question, four options, correctIndex (0–3) into options.
 */
window.DOOR_PUZZLE_BANK = [
  {
    question: "All alarms in Sector A are red. This light is not red. Can it be a Sector A alarm?",
    options: ["Yes", "No", "Only on Tuesdays", "Not enough information"],
    correctIndex: 1,
  },
  {
    question: "If it rains, the floor gets wet. The floor is wet. Does it necessarily mean it rained?",
    options: ["Yes", "No", "Only indoors", "Yes, always"],
    correctIndex: 1,
  },
  {
    question: "Complete the sequence: 2, 6, 12, 20, 30, ?",
    options: ["38", "40", "42", "44"],
    correctIndex: 2,
  },
  {
    question: "Which number is not a multiple of 4?",
    options: ["12", "18", "24", "32"],
    correctIndex: 1,
  },
  {
    question: "HAND is to GLOVE as HEAD is to ___?",
    options: ["Hair", "Hat", "Neck", "Brain"],
    correctIndex: 1,
  },
  {
    question: 'In a line, A is left of B. B is left of C. Who is rightmost?',
    options: ["A", "B", "C", "Cannot tell"],
    correctIndex: 2,
  },
  {
    question: "A vault opens only if both keys A and B are used. Key A is used. Is the vault open?",
    options: ["Yes", "No", "Depends on the door", "Yes, partially"],
    correctIndex: 1,
  },
  {
    question: "Pattern: ○ △ ○ ○ △ ○ ○ ○ △ … How many ○ appear before the 4th △?",
    options: ["6", "7", "8", "9"],
    correctIndex: 0,
  },
  {
    question: "If NO door is unlocked WITHOUT a code, and this door has no code, then:",
    options: [
      "It must be unlocked",
      "It cannot be unlocked",
      "It is unlocked half the time",
      "Codes do not matter",
    ],
    correctIndex: 1,
  },
  {
    question: "A clock shows 3:15. What is the angle between the hour and minute hands?",
    options: ["0°", "7.5°", "90°", "82.5°"],
    correctIndex: 1,
  },
  {
    question: "Which word does not belong? Triangle, Square, Circle, Pentagon",
    options: ["Triangle", "Square", "Circle", "Pentagon"],
    correctIndex: 2,
  },
  {
    question: "In binary, what is 5 + 3?",
    options: ["1000₂", "1100₂", "1110₂", "1010₂"],
    correctIndex: 0,
  },
  {
    question: "Tom is faster than Sue. Sue is faster than Ann. Who is NOT the slowest?",
    options: ["Only Tom", "Tom or Sue", "Only Ann", "Tom and Sue both"],
    correctIndex: 3,
  },
  {
    question: "Reverse the word PART → TRAP. Reverse FLOW → ___?",
    options: ["WOLF", "LOFW", "FOWL", "WLFO"],
    correctIndex: 0,
  },
  {
    question: "Choose the next letter: A, C, F, J, O, ?",
    options: ["S", "T", "U", "V"],
    correctIndex: 2,
  },
  {
    question: "If some keys are brass and all brass keys are heavy, can a key be heavy without being brass?",
    options: ["No, never", "Yes, possibly", "Only if painted", "All keys are brass"],
    correctIndex: 1,
  },
  {
    question: "What is 15% of 200?",
    options: ["20", "25", "30", "35"],
    correctIndex: 2,
  },
  {
    question: "Complete: 1, 4, 9, 16, 25, ?",
    options: ["30", "36", "49", "34"],
    correctIndex: 1,
  },
  {
    question: "BOOK is to READ as FOOD is to ___?",
    options: ["Cook", "Eat", "Kitchen", "Hungry"],
    correctIndex: 1,
  },
  {
    question: "In a race, P finishes before Q. Q finishes before R. Who finishes last?",
    options: ["P", "Q", "R", "Cannot tell"],
    correctIndex: 2,
  },
  {
    question: "Which is smallest?",
    options: ["0.09", "0.11", "1/8", "0.125"],
    correctIndex: 0,
  },
  {
    question: "Two statements: (1) The light is on. (2) The light is off. Can both be true at once?",
    options: ["Yes", "No", "Only at dusk", "Only if broken"],
    correctIndex: 1,
  },
  {
    question: "How many edges does a cube have?",
    options: ["6", "8", "12", "10"],
    correctIndex: 2,
  },
  {
    question: "Next in sequence: Z, Y, X, W, ?",
    options: ["U", "T", "V", "S"],
    correctIndex: 2,
  },
  {
    question: "If today is Wednesday, what day is it 10 days from now?",
    options: ["Friday", "Saturday", "Sunday", "Monday"],
    correctIndex: 1,
  },
  {
    question: "Odd one out: Apple, Carrot, Banana, Orange",
    options: ["Apple", "Carrot", "Banana", "Orange"],
    correctIndex: 1,
  },
  {
    question: "What is the value of 2³ + 3²?",
    options: ["15", "17", "18", "21"],
    correctIndex: 1,
  },
  {
    question: "All birds have feathers. Tweety is a bird. Therefore Tweety has ___?",
    options: ["wings only", "feathers", "a cage", "no legs"],
    correctIndex: 1,
  },
  {
    question: "Decimal 0.25 as a fraction in lowest terms is:",
    options: ["1/3", "1/4", "2/5", "3/10"],
    correctIndex: 1,
  },
  {
    question: "Complete: 5, 10, 20, 40, ?",
    options: ["60", "70", "80", "100"],
    correctIndex: 2,
  },
  {
    question: "Which number is prime?",
    options: ["21", "27", "29", "33"],
    correctIndex: 2,
  },
  {
    question: "COLD is to HOT as DARK is to ___?",
    options: ["Night", "Bright", "Light", "Black"],
    correctIndex: 2,
  },
  {
    question: "If 4 machines make 4 widgets in 4 minutes, how many minutes for 100 machines to make 100 widgets?",
    options: ["1", "4", "25", "100"],
    correctIndex: 1,
  },
  {
    question: "A shirt costs $40 after a 20% discount. What was the original price?",
    options: ["$48", "$50", "$52", "$45"],
    correctIndex: 1,
  },
  {
    question: "Logical opposite of ALWAYS is closest to:",
    options: ["Often", "Never", "Sometimes", "Usually"],
    correctIndex: 1,
  },
  {
    question: "How many degrees in one interior angle of a regular hexagon?",
    options: ["108°", "120°", "135°", "144°"],
    correctIndex: 1,
  },
  {
    question: "BEFORE is to AFTER as PREVIOUS is to ___?",
    options: ["Past", "Next", "First", "Old"],
    correctIndex: 1,
  },
  {
    question: "If you flip a fair coin twice, probability of two heads?",
    options: ["1/2", "1/3", "1/4", "1/8"],
    correctIndex: 2,
  },
  {
    question: "Which is a valid conclusion? No cats are dogs. All lions are cats.",
    options: ["All lions are dogs", "No lions are dogs", "Some lions are dogs", "All dogs are lions"],
    correctIndex: 1,
  },
  {
    question: "The middle value of 3, 7, 9, 12, 15 (when sorted) is:",
    options: ["7", "9", "12", "8"],
    correctIndex: 1,
  },
  {
    question: "Hexadecimal digit F equals decimal:",
    options: ["14", "15", "16", "17"],
    correctIndex: 1,
  },
  {
    question: "Rearrange letters RATE to spell something you do with numbers — which word fits?",
    options: ["TEAR", "TARE", "RATE", "EART"],
    correctIndex: 2,
  },
  {
    question: "If x + 7 = 15, what is x?",
    options: ["6", "7", "8", "9"],
    correctIndex: 2,
  },
  {
    question: "Which fraction is largest?",
    options: ["1/3", "3/8", "2/5", "4/11"],
    correctIndex: 2,
  },
  {
    question: "A train travels 180 km in 3 hours at constant speed. Speed in km/h?",
    options: ["50", "55", "60", "65"],
    correctIndex: 2,
  },
  {
    question: "Synonym closest to BRIEF:",
    options: ["Long", "Short", "Heavy", "Slow"],
    correctIndex: 1,
  },
  {
    question: "Counting: 101, 102, 103, … What is the 5th number in this list?",
    options: ["104", "105", "106", "107"],
    correctIndex: 1,
  },
  {
    question: "If A implies B, and B is false, then A must be:",
    options: ["True", "False", "Unknown", "Both"],
    correctIndex: 1,
  },
  {
    question: "Perimeter of a square with side 7?",
    options: ["14", "21", "28", "49"],
    correctIndex: 2,
  },
  {
    question: "Which does not fit? Copper, Iron, Aluminum, Wood",
    options: ["Copper", "Iron", "Aluminum", "Wood"],
    correctIndex: 3,
  },
  {
    question: "Next number: 1, 1, 2, 3, 5, 8, ?",
    options: ["11", "12", "13", "14"],
    correctIndex: 2,
  },
  {
    question: "Opposite of INCREASE:",
    options: ["Grow", "Decrease", "Stay", "Double"],
    correctIndex: 1,
  },
  {
    question: "How many minutes are in 2.5 hours?",
    options: ["120", "130", "140", "150"],
    correctIndex: 3,
  },
  {
    question: "If north is up, east is to the right of north. West is to the ___ of north.",
    options: ["right", "left", "down", "same"],
    correctIndex: 1,
  },
  {
    question: "Binary 1010 (unsigned) equals decimal:",
    options: ["8", "9", "10", "12"],
    correctIndex: 2,
  },
  {
    question: "A dozen plus a half-dozen equals:",
    options: ["15", "16", "18", "20"],
    correctIndex: 2,
  },
  {
    question: "Which word is spelled correctly?",
    options: ["Recieve", "Receive", "Receeve", "Receiv"],
    correctIndex: 1,
  },
  {
    question: "If 5 pencils cost $2.50, how much for 8 pencils at the same rate?",
    options: ["$3.50", "$4.00", "$4.50", "$5.00"],
    correctIndex: 1,
  },
  {
    question: "Complete analogy: Minute is to Hour as Second is to ___?",
    options: ["Day", "Minute", "Week", "Month"],
    correctIndex: 1,
  },
  {
    question: "Surface area of one face of a cube with edge 3 (same units²)?",
    options: ["6", "9", "12", "27"],
    correctIndex: 1,
  },
  {
    question: "Which is an even integer?",
    options: ["√9", "√16", "√25", "√27"],
    correctIndex: 1,
  },
  {
    question: "Negation of 'Every door is locked':",
    options: [
      "No door is locked",
      "Some door is not locked",
      "Every door is open",
      "Some door is locked",
    ],
    correctIndex: 1,
  },
  {
    question: "Order from smallest to largest: 0.2, 1/5, 0.19",
    options: [
      "0.19, 0.2, 1/5",
      "1/5, 0.19, 0.2",
      "0.2, 1/5, 0.19",
      "All equal",
    ],
    correctIndex: 0,
  },
  {
    question: "A palindrome reads the same backward. Which is a palindrome?",
    options: ["RADAR", "TOWER", "FLOOR", "BUILD"],
    correctIndex: 0,
  },
  {
    question: "If the code ROT13 maps A→N, what letter maps to H?",
    options: ["T", "U", "V", "W"],
    correctIndex: 1,
  },
  {
    question: "Average of 10, 20, and 30?",
    options: ["15", "18", "20", "25"],
    correctIndex: 2,
  },
  {
    question: "Which is heavier? (same volume)",
    options: ["Cork", "Lead", "Foam", "Air"],
    correctIndex: 1,
  },
  {
    question: "What is 9 × 8?",
    options: ["63", "64", "72", "81"],
    correctIndex: 2,
  },
  {
    question: "How many faces does a standard six-sided die have?",
    options: ["4", "5", "6", "8"],
    correctIndex: 2,
  },
  {
    question: "If MONDAY is coded by shifting each letter +1 (Caesar), N becomes:",
    options: ["M", "O", "P", "N"],
    correctIndex: 1,
  },
  {
    question: "√144 + √81 = ?",
    options: ["18", "19", "20", "21"],
    correctIndex: 3,
  },
  {
    question: "Which pair are antonyms?",
    options: ["Hot / Warm", "Big / Large", "Start / Begin", "Loose / Tight"],
    correctIndex: 3,
  },
  {
    question: "A leap year has at most how many days?",
    options: ["364", "365", "366", "367"],
    correctIndex: 2,
  },
  {
    question: "Simplify: (12 ÷ 3) × 2",
    options: ["4", "6", "8", "12"],
    correctIndex: 2,
  },
  {
    question: "If all roses are flowers and this is a rose, it is a:",
    options: ["tree", "flower", "thorn", "color"],
    correctIndex: 1,
  },
  {
    question: "Decimal for 3/4?",
    options: ["0.25", "0.5", "0.75", "0.8"],
    correctIndex: 2,
  },
  {
    question: "Which number completes: 2, 3, 5, 7, 11, ?",
    options: ["12", "13", "15", "17"],
    correctIndex: 1,
  },
  {
    question: "Cold is to Freeze as Hot is to ___?",
    options: ["Warm", "Melt", "Ice", "Snow"],
    correctIndex: 1,
  },
  {
    question: "How many vertices does a square pyramid have (base + apex)?",
    options: ["4", "5", "6", "8"],
    correctIndex: 1,
  },
  {
    question: "What is 50% of 48?",
    options: ["20", "22", "24", "26"],
    correctIndex: 2,
  },
];
