import pandas as pd
import json
import os
from typing import List, Dict, Union, Optional
from dataclasses import dataclass, asdict
from openai import OpenAI
import time
from tqdm import tqdm

BATCH_SIZE = 20

@dataclass
class PrereqGroup:
    type: str  # "AND" or "OR"
    courses: List[Union[str, 'PrereqGroup']]  # Can contain course IDs or nested groups
    min_grade: Optional[str] = None

@dataclass
class Course:
    id: str
    prerequisites: Optional[PrereqGroup] = None
    corequisites: List[str] = None
    cross_listed: List[str] = None
    notes: str = None

class CourseProcessor:
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
        
        self.prompt_template = """
Extract course relationships from this description. Return a JSON object with this structure:
{
    "prerequisites": {
        "type": "AND",           // How prerequisites combine: "AND" or "OR"
        "courses": [             // Can contain course codes or nested groups
            "MATH 101",          // Simple prerequisite
            {                    // Nested group for complex logic
                "type": "OR",
                "courses": ["MATH 102", "AMTH 108"],
                "min_grade": "C-"
            }
        ],
        "min_grade": "C-"       // Default grade requirement for this group
    },
    "corequisites": ["MATH 101L"],  // List of concurrent courses
    "cross_listed": ["CSCI 147"],   // Cross-listed courses
    "notes": "Permission of instructor required"  // Special conditions
}

For complex prerequisites, use nested groups with their own type (AND/OR).
Each group can have its own grade requirement.
If any field is not applicable, use null or empty array.

Example of complex prerequisites:
For "MATH 122 or AMTH 108, and MATH/CSCI 146 with C- or better":
{
    "prerequisites": {
        "type": "AND",
        "courses": [
            {
                "type": "OR",
                "courses": ["MATH 122", "AMTH 108"],
                "min_grade": "C-"
            },
            {
                "type": "OR",
                "courses": ["MATH 146", "CSCI 146"],
                "min_grade": "C-"
            }
        ]
    }
}

Course: {department} {number}
Description: {description}

Provide only valid JSON as response, no other text.
"""

    def process_batch(self, courses: List[Dict]) -> List[Course]:
        """Process a batch of courses using GPT-4."""
        messages = [{"role": "user", "content": self.prompt_template.format(**course)} 
                   for course in courses]
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "system", "content": "Extract course relationships in JSON format."}] + messages,
                temperature=0
            )
            
            results = []
            for i, choice in enumerate(response.choices):
                try:
                    data = json.loads(choice.message.content)
                    results.append(Course(
                        id=f"{courses[i]['department']} {courses[i]['number']}",
                        prerequisites=self._parse_prereq_group(data.get('prerequisites')),
                        corequisites=data.get('corequisites', []),
                        cross_listed=data.get('cross_listed', []),
                        notes=data.get('notes')
                    ))
                except Exception as e:
                    print(f"Error processing {courses[i]['department']} {courses[i]['number']}: {str(e)}")
                    results.append(None)
            
            return results
        
        except Exception as e:
            print(f"Batch processing error: {str(e)}")
            return [None] * len(courses)

    def _parse_prereq_group(self, group_data: Optional[Dict]) -> Optional[PrereqGroup]:
        """Recursively parse prerequisite groups."""
        if not group_data:
            return None
            
        courses = []
        for course in group_data.get('courses', []):
            if isinstance(course, dict):
                courses.append(self._parse_prereq_group(course))
            else:
                courses.append(course)
                
        return PrereqGroup(
            type=group_data.get('type', 'AND'),
            courses=courses,
            min_grade=group_data.get('min_grade')
        )

    def _serialize_prereq_group(self, group: Optional[PrereqGroup]) -> Optional[Dict]:
        """Convert PrereqGroup to clean dictionary format."""
        if not group:
            return None
            
        result = {
            "type": group.type,
            "courses": []
        }
        
        if group.min_grade:
            result["min_grade"] = group.min_grade
            
        for course in group.courses:
            if isinstance(course, PrereqGroup):
                result["courses"].append(self._serialize_prereq_group(course))
            else:
                result["courses"].append(course)
                
        return result

    def process_csv(self, input_file: str, output_file: str):
        """Process all courses from a CSV file."""
        df = pd.read_csv(input_file)
        courses = df.to_dict('records')
        results = []
        
        for i in tqdm(range(0, len(courses), BATCH_SIZE), desc="Processing courses"):
            batch = courses[i:i + BATCH_SIZE]
            batch_results = self.process_batch(batch)
            results.extend(batch_results)
            time.sleep(1)
        
        # Convert to clean dictionary format
        clean_results = {}
        for result in results:
            if result is not None:
                clean_results[result.id] = {
                    'prerequisites': self._serialize_prereq_group(result.prerequisites),
                    'corequisites': result.corequisites if result.corequisites else None,
                    'cross_listed': result.cross_listed if result.cross_listed else None,
                    'notes': result.notes if result.notes else None
                }
                # Remove empty fields
                clean_results[result.id] = {
                    k: v for k, v in clean_results[result.id].items() 
                    if v not in ([], None, '', {})
                }
        
        # Save results
        with open(output_file, 'w') as f:
            json.dump(clean_results, f, indent=2, sort_keys=True)
        
        return clean_results

def main():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment variables")
    
    processor = CourseProcessor(api_key)
    results = processor.process_csv("courses.csv", "course_requirements.json")
    
    # Print a sample complex prerequisite
    sample = next(
        (course for course in results.items() 
         if course[1].get('prerequisites', {}).get('courses', []) and 
         any(isinstance(c, dict) for c in course[1]['prerequisites']['courses'])),
        None
    )
    if sample:
        print("\nExample of complex prerequisites:")
        print(json.dumps(sample[1], indent=2))

if __name__ == "__main__":
    main()