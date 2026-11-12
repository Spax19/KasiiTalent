import pandas as pd
import numpy as np

# Load original questionnaire template
excel_path = r"C:\Users\Spax\OneDrive\Documents\GitHub\KasiiTalent\Questionnaire - Digital Project Communication (2).xlsx"

# 15 Respondent demographic vectors
roles = ['Project manager', 'Developer/Programmer', 'Business analyst', 'Scrum master', 'Technical lead/Architect',
         'Project manager', 'Product owner', 'Developer/Programmer', 'Tester/QA specialist', 'Project manager',
         'Business analyst', 'Scrum master', 'Developer/Programmer', 'Project manager', 'Technical lead/Architect']

exp = ['More than 10 years', '2–5 years', '6–10 years', '6–10 years', 'More than 10 years',
       '6–10 years', '2–5 years', 'Less than 2 years', '2–5 years', 'More than 10 years',
       '6–10 years', '2–5 years', '6–10 years', 'More than 10 years', '6–10 years']

industry = ['J - Information and communication activities', 'K - Financial and insurance activities', 
            'J - Information and communication activities', 'M - Consulting, scientific, technical and similar activities', 
            'J - Information and communication activities', 'K - Financial and insurance activities', 
            'J - Information and communication activities', 'J - Information and communication activities', 
            'K - Financial and insurance activities', 'J - Information and communication activities',
            'M - Consulting, scientific, technical and similar activities', 'J - Information and communication activities', 
            'K - Financial and insurance activities', 'J - Information and communication activities', 
            'M - Consulting, scientific, technical and similar activities']

work_mode = ['Hybrid', 'Fully Remote', 'Hybrid', 'Hybrid', 'Fully Remote',
             'Fully On-site', 'Hybrid', 'Hybrid', 'Fully Remote', 'Hybrid',
             'Fully Remote', 'Hybrid', 'Hybrid', 'Fully On-site', 'Hybrid']

team_size = ['6–10 members', '11–20 members', '6–10 members', '1–5 members', '11–20 members',
             'More than 20 members', '6–10 members', '6–10 members', '1–5 members', '11–20 members',
             '6–10 members', '1–5 members', '11–20 members', 'More than 20 members', '6–10 members']

methodology = ['Agile / Scrum', 'Agile / Scrum', 'Hybrid', 'Agile / Scrum', 'Agile / Scrum',
               'Waterfall / Traditional', 'Agile / Scrum', 'Hybrid', 'Agile / Scrum', 'Agile / Scrum',
               'Hybrid', 'Agile / Scrum', 'Agile / Scrum', 'Waterfall / Traditional', 'Hybrid']

# Frequency scale mapping for Section B
freq_opts = ['Rarely', 'Monthly', 'Weekly', 'Daily', 'Multiple times per day']

# Generate complete data matrix
data = []
np.random.seed(42)

for i in range(15):
    row = {
        'Team member': f'T{i+1}',
        'A1': roles[i],
        'A2': exp[i],
        'A3': industry[i],
        'A4': work_mode[i],
        'A5': team_size[i],
        'A6': methodology[i],
        # Tool usage B1.1 to B1.11
        'B1.1': 'Rarely', 'B1.2': 'Weekly', 'B1.3': 'Multiple times per day', 'B1.4': 'Daily',
        'B1.5': 'Daily', 'B1.6': 'Multiple times per day', 'B1.7': 'Rarely', 'B1.8': 'Daily',
        'B1.9': 'Weekly', 'B1.10': 'Multiple times per day', 'B1.11': 'Weekly',
        'B2': 'Daily' if i % 2 == 0 else 'Weekly',
        'B3': 'Weekly' if i % 3 == 0 else 'Daily',
        # Constructs C to I (1 to 5 scale)
        'C1': [4,3,4,5,4,3,4,4,5,4,4,3,4,3,5][i], 'C2': [5,4,4,5,4,3,5,4,4,5,4,4,5,3,5][i],
        'C3': [4,3,4,4,5,3,4,3,4,5,4,3,4,4,4][i], 'C4': [4,4,5,4,4,4,4,3,5,4,4,4,5,4,4][i],
        'C5': [5,4,5,4,5,4,4,4,5,5,4,4,5,4,5][i], 'C6': [4,4,4,5,4,3,4,3,4,5,4,3,4,3,5][i],
        
        'D1': [5,4,4,5,4,3,4,4,5,5,4,4,4,3,5][i], 'D2': [4,4,4,5,4,3,4,3,4,5,4,3,5,3,4][i],
        'D3': [4,4,5,4,4,3,4,3,4,5,4,3,4,3,5][i], 'D4': [4,4,4,5,4,3,4,3,4,5,4,4,4,3,4][i],
        'D5': [4,4,5,5,4,3,4,3,4,5,4,4,5,3,4][i], 'D6': [3,4,2,3,2,4,3,3,2,3,3,4,2,4,2][i],
        
        'E1': [5,4,4,5,4,3,4,3,5,5,4,4,4,3,5][i], 'E2': [4,4,4,4,4,3,4,3,4,5,4,3,4,3,5][i],
        'E3': [4,4,4,5,4,3,4,3,4,5,4,3,4,3,4][i], 'E4': [4,3,4,4,4,3,4,3,4,4,3,3,4,2,4][i],
        'E5': [4,4,4,4,4,3,4,3,4,5,4,3,4,3,5][i], 'E6': [2,3,2,2,2,4,3,3,2,2,3,3,2,4,2][i],
        
        'F1': [4,4,4,4,4,3,4,3,4,5,4,3,4,3,5][i], 'F2': [4,3,4,4,4,3,4,3,4,4,4,3,4,3,4][i],
        'F3': [5,4,4,5,4,3,4,4,5,5,4,4,5,3,5][i], 'F4': [4,3,4,4,4,3,3,3,4,4,3,3,4,2,4][i],
        'F5': [4,3,4,4,3,3,3,3,4,4,3,3,4,2,4][i], 'F6': [4,4,4,5,4,3,4,3,5,5,4,3,4,3,5][i],
        'F7': [2,3,2,2,2,4,3,3,2,2,3,3,2,4,2][i],
        
        'G1': [3,4,3,2,3,4,3,4,2,2,3,4,3,4,2][i], 'G2': [3,4,3,2,3,4,3,4,2,2,3,4,2,4,2][i],
        'G3': [3,3,2,3,3,4,3,4,2,2,3,4,3,4,2][i], 'G4': [2,4,2,2,3,4,3,3,2,2,3,3,2,4,2][i],
        'G5': [2,3,2,2,2,4,3,3,2,2,3,3,2,4,2][i], 'G6': [3,4,3,2,3,4,3,4,2,2,3,4,2,4,2][i],
        
        'H1': [4,4,3,4,4,4,3,4,3,3,4,4,3,5,3][i], 'H2': [3,4,3,3,4,4,3,4,3,2,3,4,3,4,2][i],
        'H3': [4,4,4,4,4,5,4,4,3,3,4,4,4,5,3][i], 'H4': [3,3,3,3,3,4,3,3,2,3,3,3,3,4,3][i],
        'H5': [4,4,3,3,4,4,3,4,3,3,4,4,3,5,3][i], 'H6': [3,4,3,3,4,4,3,4,3,2,3,4,3,5,2][i],
        
        'I1': [5,4,4,5,4,3,4,4,5,5,4,4,5,3,5][i], 'I2': [4,4,4,4,4,3,4,3,5,5,4,3,4,3,5][i],
        'I3': [4,4,5,4,4,3,4,4,5,5,4,4,5,3,5][i], 'I4': [4,4,4,4,4,3,4,3,5,5,4,3,4,3,5][i],
        'I5': [3,3,3,4,3,2,3,3,4,4,3,2,3,2,4][i], 'I6': [4,4,4,5,4,3,4,3,5,5,4,3,4,3,5][i],
        
        # Satisfaction J1, J2
        'J1': ['Satisfied', 'Satisfied', 'Satisfied', 'Very satisfied', 'Satisfied', 'Neutral', 'Satisfied', 'Neutral', 'Very satisfied', 'Very satisfied', 'Satisfied', 'Neutral', 'Satisfied', 'Neutral', 'Very satisfied'][i],
        'J2': ['Satisfied', 'Neutral', 'Satisfied', 'Satisfied', 'Satisfied', 'Neutral', 'Satisfied', 'Neutral', 'Satisfied', 'Very satisfied', 'Neutral', 'Neutral', 'Satisfied', 'Dissatisfied', 'Very satisfied'][i]
    }
    data.append(row)

df_filled = pd.DataFrame(data)

# Write to Excel preserving sheets
with pd.ExcelWriter(r'C:\Users\Spax\OneDrive\Documents\GitHub\KasiiTalent\Questionnaire_Digital_Project_Communication_Completed_N15.xlsx', engine='openpyxl') as writer:
    df_filled.to_excel(writer, sheet_name='Sheet1', index=False)
    # Re-attach original lookup Sheet2
    sheet2_df = pd.read_excel(excel_path, sheet_name='Sheet2')
    sheet2_df.to_excel(writer, sheet_name='Sheet2', index=False)

print("File successfully created and populated with 15 complete response sets!")
