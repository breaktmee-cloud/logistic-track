from flask import Flask, request, jsonify
from flask_cors import CORS
import gspread
from google.oauth2.service_account import Credentials
import os
from datetime import datetime
import logging

# Configuración de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Habilita CORS para todas las rutas

# Configuración
SCOPE = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = 'TU_SPREADSHEET_ID_AQUI'

def get_sheets_client():
    """Conecta con Google Sheets"""
    try:
        # Para producción (variables de entorno)
        if 'GOOGLE_CREDENTIALS_JSON' in os.environ:
            import json
            creds_json = json.loads(os.environ['GOOGLE_CREDENTIALS_JSON'])
            creds = Credentials.from_service_account_info(creds_json, scopes=SCOPE)
        # Para desarrollo local
        elif os.path.exists('credentials.json'):
            creds = Credentials.from_service_account_file('credentials.json', scopes=SCOPE)
        else:
            raise Exception('No se encontraron credenciales de Google')
        
        return gspread.authorize(creds)
    except Exception as e:
        logger.error(f"Error conectando con Google Sheets: {str(e)}")
        raise

@app.route('/api/health', methods=['GET'])
def health_check():
    """Endpoint de salud del servidor"""
    return jsonify({
        'status': 'OK',
        'message': 'Servidor funcionando correctamente',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/registrations', methods=['POST'])
def add_registration():
    """Agrega un nuevo registro a Google Sheets"""
    try:
        data = request.get_json()
        
        # Validar datos requeridos
        required_fields = ['packageCode', 'phone', 'latitude', 'longitude']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Campo requerido faltante: {field}'
                }), 400
        
        # Validar formato del código de paquete
        if not data['packageCode'].startswith('6') or len(data['packageCode']) != 13:
            return jsonify({
                'success': False,
                'error': 'El código debe empezar con 6 y tener 13 dígitos'
            }), 400
        
        # Validar teléfono
        phone_digits = ''.join(filter(str.isdigit, data['phone']))
        if len(phone_digits) != 9:
            return jsonify({
                'success': False,
                'error': 'El teléfono debe tener 9 dígitos'
            }), 400
        
        # Conectar con Google Sheets
        client = get_sheets_client()
        sheet = client.open_by_key(SPREADSHEET_ID).sheet1
        
        # Preparar datos para guardar
        timestamp = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
        row_data = [
            data['packageCode'],
            phone_digits,
            f"{data['latitude']}, {data['longitude']}",
            timestamp,
            'SÍ' if data.get('isPickup', False) else 'NO'
        ]
        
        # Guardar en Google Sheets
        sheet.append_row(row_data)
        
        logger.info(f"Registro guardado: {data['packageCode']}")
        
        return jsonify({
            'success': True,
            'message': 'Registro guardado exitosamente en Google Sheets',
            'timestamp': timestamp,
            'row': len(sheet.get_all_values())
        })
        
    except Exception as e:
        logger.error(f"Error en /api/registrations: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Error del servidor: {str(e)}'
        }), 500

@app.route('/api/registrations', methods=['GET'])
def get_registrations():
    """Obtiene todos los registros"""
    try:
        client = get_sheets_client()
        sheet = client.open_by_key(SPREADSHEET_ID).sheet1
        
        # Obtener todos los registros (excluyendo encabezados)
        records = sheet.get_all_records()
        
        return jsonify({
            'success': True,
            'data': records,
            'count': len(records)
        })
        
    except Exception as e:
        logger.error(f"Error en /api/registrations GET: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)