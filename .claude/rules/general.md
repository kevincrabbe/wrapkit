- Focus 80% on readablilty and 20% on being performance
In order of importance: 
    1. Correctness and functionality 
    2. Readablity & Maintainability 
    3. Performance


# Comments
Add comments only when they explain WHY, not WHAT. 
The code itself should be readable enough to show WHAT it does.

DO NOT comment obvious operations like:
// increment counter
counter++;

DO comment:
- Business logic reasoning
- Non-obvious decisions
- Workarounds or edge cases
- Complex algorithms (brief summary of approach)

Example of a good comment:
// Using ceil() here because partial units must be charged as full units per billing policy
const billableUnits = Math.ceil(usage / unitSize);
