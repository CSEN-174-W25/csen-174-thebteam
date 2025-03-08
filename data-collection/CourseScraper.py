import requests
from bs4 import BeautifulSoup
import pandas as pd
import re

class CourseScraper:
    def __init__(self):
        self.base = 'https://www.scu.edu/bulletin/undergraduate/'
        self.tag_map = {
            'Anthropology': 'ANTH',
            'Art  and  Art  History': 'ARTH',
            'Biology': 'BIOL',
            'Chemistry and Biochemistry': 'CHEM',
            'Child Studies': 'CHST',
            'Classics': 'CLAS',
            'Communication': 'COMM',
            'Economics': 'ECON',
            'English': 'ENGL',
            'Environmental  Studies  and  Sciences': 'ENVS',
            'Ethnic Studies': 'ETHN',
            'Gender and Sexuality Studies': 'WGST',
            'History': 'HIST',
            'Mathematics': 'MATH',
            'Computer Science': 'CSCI',
            'Arabic Studies': 'ARAB',
            'Chinese Studies': 'CHIN',
            'French Studies': 'FREN',
            'German Studies': 'GERM',
            'Italian Studies': 'ITAL',
            'Japanese Studies': 'JAPN',
            'Spanish Studies': 'SPAN',
            'Music': 'MUSC',
            'Neuroscience': 'NEUR',
            'Philosophy': 'PHIL',
            'Physics': 'PHYS',
            'Political Science': 'POLI',
            'Psychology': 'PSYC',
            'Public  Health  Department': 'PHSC',
            'Scripture and Tradition (SCTR)': 'SCTR',
            'Theology, Ethics, and Spirituality (TESP)': 'TESP',
            'Religion and Society (RSOC)': 'RSOC',
            'Sociology': 'SOCI',
            'Theatre': 'THTR',
            'Dance': 'DANC',
            'Accounting': 'ACTG',
            'Finance': 'FNCE',
            'Management': 'MGMT',
            'Marketing': 'MKTG',
            'Information  Systems &  Analytics': 'OMIS',
            'Applied Mathematics': 'AMTH',
            'Bioengineering': 'BIOE',
            'Civil, Environmental, and Sustainable  Engineering': 'CENG',
            'Computer  Science  and  Engineering': 'CSEN',
            'Electrical and Computer Engineering': 'ECEN',
            'General Engineering': 'ENGR',
            'Mechanical  Engineering': 'MECH',
        }

        # Send a GET request to fetch the page content
        response = requests.get(self.base)

        # Check if the request was successful
        if response.status_code == 200:
            page_content = response.text
        else:
            print(f"Failed to retrieve content from {self.base}")
            exit()

        # Create a BeautifulSoup object to parse the HTML content
        self.soup = BeautifulSoup(page_content, 'html.parser')

    def _get_url_map(self):
        sidebar = self.soup.find_all('ul', class_='bltFolder')

        college_tag = {
            'CAS': sidebar[3],
            'LSB': sidebar[4],
            'SOE': sidebar[5]
        }

        url_map = {}
        skip = set([
            ' Medical  and  Health  Humanities ',
            ' Undergraduate Degrees',
            ' Centers Institutes and Special Programs'
        ])

        for college, tag in college_tag.items():
            for anchor in tag.find_all('a'):
                department = anchor.get_text().strip()
                if department in skip or not department:
                    continue

                url = self.base + anchor.get('href')[2:]
                url_map[(college, department)] = url

        return url_map

    def _get_course_info(self, soupObj: BeautifulSoup, college, department, show=False):
        content = soupObj.find('body', class_='doc-content')

        col = []
        dep = []
        num = []
        cou = []
        des = []
        tags = []

        # Initialize category and state
        if department.replace('  ', ' ') == 'Theatre and Dance':
            current_category = "Theatre"
            reached_dance = False
        elif department.replace('  ', ' ') == 'Mathematics and Computer Science':
            current_category = "Mathematics"
            is_cs_section = False
        else:
            current_category = department

        last_course_num = None
        print(f"\nProcessing {department} with initial category: {current_category}")

        # Process course info...
        language_keywords = re.compile(r'\b(Arabic|Chinese|French|German|Italian|Japanese|Spanish)\b', re.IGNORECASE)
        religious_studies_categories = {
            "Scripture and Tradition (SCTR)": re.compile(r'Scripture and Tradition', re.IGNORECASE),
            "Theology, Ethics, and Spirituality (TESP)": re.compile(r'Theology, Ethics, and Spirituality', re.IGNORECASE),
            "Religion and Society (RSOC)": re.compile(r'Religion and Society', re.IGNORECASE),
        }

        current_desc = ""
        last_course_index = -1

        for elm in content.children:
            if elm.name == 'h2':  # Detect section headers
                for category, pattern in religious_studies_categories.items():
                    if pattern.search(elm.get_text()):
                        current_category = category
                        print(f"Switching Religious Studies category to: {current_category}")
                        break

            if elm.name == 'p':  # Capture descriptions
                text = elm.get_text().strip()
                if text and last_course_index >= 0:
                    des[last_course_index] += " " + text

            if elm.name == 'h3':
                arr = elm.get_text().split('.')
                if len(arr) < 2:
                    continue

                number = arr[0].strip()
                course = '.'.join(arr[1:]).strip()

                if not re.match(r'^[0-9]+[A-Za-z]*$', number):
                    continue

                # Handle department splits
                if department.replace('  ', ' ') in ['Mathematics and Computer Science', 'Theatre and Dance']:
                    try:
                        base_num = int(re.match(r'^(\d+)', number).group(1))

                        if department.replace('  ', ' ') == 'Theatre and Dance':
                            print(f"Processing course {number} (base_num: {base_num}, last: {last_course_num})")

                            # Check for transition to Dance section
                            if base_num == 4 and not reached_dance and last_course_num and last_course_num > 100:
                                current_category = "Dance"
                                reached_dance = True
                                print(f"Switching to Dance at course {number}")
                            elif reached_dance:
                                current_category = "Dance"
                            else:
                                current_category = "Theatre"
                        elif department.replace('  ', ' ') == 'Mathematics and Computer Science':
                            if last_course_num and base_num < last_course_num - 50 and not is_cs_section:
                                current_category = "Computer Science"
                                is_cs_section = True
                                print(f"Switching to CS at number {base_num}")
                            elif is_cs_section:
                                current_category = "Computer Science"
                            else:
                                current_category = "Mathematics"

                        last_course_num = base_num
                        print(f"Category is now: {current_category}")

                    except Exception as e:
                        print(f"Error processing course {number}: {str(e)}")

                # Handle language studies categories
                elif department == 'Modern Languages and Literatures':
                    match = language_keywords.search(course)
                    if match:
                        current_category = match.group(0) + ' Studies'
                        print(f"Detected language: {current_category} for course {number}")

                col.append(college)
                dep.append(current_category)
                num.append(number)
                cou.append(course)
                des.append("")  # Placeholder for description
                # Get the course tag from the map
                tag = self.tag_map.get(current_category, '')
                tags.append(tag)
                last_course_index = len(des) - 1

        return col, dep, num, cou, des, tags

    def _get_pre_reqs(self, course_desc: str, course_num: str) -> dict:
        """
        Extract requirement text but leave the units part in the description.
        Special handling for lab courses with short descriptions.
        """
        if not course_desc:
            return {"prereq_text": "", "start_idx": -1, "end_idx": -1, "units_text": ""}

        # Check if this is a lab course (ends with 'L')
        is_lab_course = course_num and course_num.endswith('L')
        
        # For very short descriptions (like in lab courses), handle differently
        is_short_desc = len(course_desc.split()) < 10
        
        # All requirement keywords we want to match
        req_keywords = [
            r'prerequisite[s]?:', r'prereq[s]?:', r'pre-?requisite[s]?:',
            r'corequisite[s]?:', r'coreq[s]?:', r'co-?requisite[s]?:',
            r'successful completion of', r'concurrent enrollment',
            r'must have taken', r'must have completed'
        ]
        
        # Combined pattern for any requirement keyword
        pattern = '|'.join([r'\b' + kw for kw in req_keywords])
        req_regex = re.compile(pattern, re.IGNORECASE)
        
        # Find first occurrence of any requirement keyword
        match = req_regex.search(course_desc)
        if not match:
            return {"prereq_text": "", "start_idx": -1, "end_idx": -1, "units_text": ""}
        
        # Find the units pattern (e.g., "(4 units)" or "(5 units)" or "(1 unit)")
        units_pattern = r'\(\d+\s+units?\)'
        units_regex = re.compile(units_pattern)
        units_match = units_regex.search(course_desc)
        
        # Special handling for lab courses with short descriptions
        if is_lab_course and is_short_desc:
            # Extract just the corequisite/prerequisite info without removing from description
            start_idx = match.start()
            end_idx = len(course_desc)
            
            # Get the requirement text
            prereq_text = course_desc[start_idx:end_idx].strip()
            
            # Remove units from prereq text if present
            if units_match and units_match.start() > start_idx:
                prereq_text = prereq_text.replace(units_match.group(0), "").strip()
                units_text = units_match.group(0)
            else:
                units_text = ""
            
            # For lab courses, don't remove from description
            return {
                "prereq_text": prereq_text,
                "start_idx": -1,  # Special value for "don't remove from description"
                "end_idx": -1,
                "units_text": units_text
            }
        
        # Standard extraction for regular courses
        start_idx = match.start()
        end_idx = len(course_desc)
        units_text = ""
        
        # If we found units, adjust the end index and save the units text
        if units_match:
            units_start = units_match.start()
            units_end = units_match.end()
            units_text = course_desc[units_start:units_end]
            
            # If the units are at the end of the text, adjust the end index
            if units_end > start_idx and abs(units_end - len(course_desc)) < 5:
                end_idx = units_start
        
        # Get the requirement text without the units
        prereq_text = course_desc[start_idx:end_idx].strip()
        
        # Clean up the text
        prereq_text = re.sub(r'\s+', ' ', prereq_text)
        
        # Remove any unit text that might still be in the prereq text
        prereq_text = re.sub(r'\s*\(\d+\s+units?\)\s*$', '', prereq_text)
        
        return {
            "prereq_text": prereq_text,
            "start_idx": start_idx,
            "end_idx": end_idx,
            "units_text": units_text
        }

    def add_pre_reqs(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Extract prerequisites from descriptions but keep units info in description.
        Special handling for lab courses.
        """
        cleaned_descriptions = []
        prereqs_list = []
        
        for i, row in df.iterrows():
            description = row['description']
            course_num = row['number']  # Get the course number to check if it's a lab
            
            # Extract requirement info
            prereq_info = self._get_pre_reqs(description, course_num)
            
            if prereq_info["start_idx"] >= 0:
                # Normal case - we found requirement text to extract
                
                # 1. Store the requirement text (without units)
                prereqs_list.append(prereq_info["prereq_text"])
                
                # 2. Keep text before requirements + units in the description
                clean_desc = description[:prereq_info["start_idx"]].strip()
                
                # 3. Add the units text back to the description (if found)
                if prereq_info["units_text"] and not clean_desc.endswith(prereq_info["units_text"]):
                    clean_desc = f"{clean_desc} {prereq_info['units_text']}"
                
                cleaned_descriptions.append(clean_desc)
            elif prereq_info["prereq_text"]:
                # Special case for lab courses - don't remove from description
                prereqs_list.append(prereq_info["prereq_text"])
                cleaned_descriptions.append(description)
            else:
                # No requirements found
                prereqs_list.append("")
                cleaned_descriptions.append(description)
        
        # Update the DataFrame
        df['description'] = cleaned_descriptions
        df['pre_reqs'] = prereqs_list
        
        return df

    def retrieve_course_df(self) -> pd.DataFrame:
        url_map = self._get_url_map()

        colleges = []
        departments = []
        numbers = []
        courses = []
        descriptions = []
        tags = []

        for (college, department), url in url_map.items():
            # Send a GET request to fetch the page content
            response = requests.get(url)

            # Check if the request was successful
            if response.status_code == 200:
                page_content = response.text
            else:
                print(f"Failed to retrieve content from {self.base}")
                exit()

            # Create a BeautifulSoup object to parse the HTML content
            soupObj = BeautifulSoup(page_content, 'html.parser')
            col, dep, num, cou, des, tag = self._get_course_info(soupObj, college, department)

            colleges += col
            departments += dep
            numbers += num
            courses += cou
            descriptions += des
            tags += tag

        df = pd.DataFrame({
            'college': colleges,
            'department': departments,
            'number': numbers,
            'course': courses,
            'description': descriptions,
            'tag': tags
        })

        # Remove rows with missing course names and ensure valid course numbers
        df = df.dropna(subset=['course'])
        df = df[df['number'].str.match(r'^[0-9]+[A-Za-z]*$', na=False)]

        return df

def main():
    scraper = CourseScraper()
    df = scraper.retrieve_course_df()
    
    # Process the data with the integrated prerequisite extraction
    df = scraper.add_pre_reqs(df)
    
    # Save to CSV
    df.to_csv('data/courses.csv', index=False)
    print("Course data with cleaned descriptions and extracted prerequisites has been saved to 'data/courses.csv'")

    # print blank description courses
    print("Courses with blank descriptions:")
    print(df[df['description'] == ""])

if __name__ == "__main__":
    main()